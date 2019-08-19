const fs = require('fs');
const path = require('path');

const mobilenet = require('@tensorflow-models/mobilenet');
const tf = require('@tensorflow/tfjs-node');
const { createCanvas, loadImage } = require('canvas');

const dataPath = path.join(__dirname, './seefood');
const intents = {
    'hot_dog': "HOT_DOG",
    'not_hot_dog': "NOT_HOT_DOG",
};

// Classifier type can be: ncc/perceptron
const classifierType = 'ncc';

// Perceptron Classifier Config

// Nearest Centroid Classifier Config
// Normalize each sample like what will happen in production to avoid changing the centroid by too much.
const normalizeEachEmbedding = true;
// Normalizing the centroid didn't change performance by much.
// It was slightly worse for HOT_DOG precision.
const normalizeCentroid = false;


let embeddingCache;
const embeddingCachePath = path.join(__dirname, 'embedding_cache.json');
if (fs.existsSync(embeddingCachePath)) {
    embeddingCache = fs.readFileSync(embeddingCachePath, 'utf8');
    embeddingCache = JSON.parse(embeddingCache);
} else {
    embeddingCache = {};
}

async function getEmbedding(sample) {
    let result = embeddingCache[sample];
    if (result !== undefined) {
        result = tf.tensor2d([result]);
    } else {
        const img = await loadImage(path.join(dataPath, sample));
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        result = await encoder.infer(canvas, { embedding: true });
        embeddingCache[sample] = result.gather(0).arraySync();
    }
    if (normalizeEachEmbedding) {
        result = normalize2d(result);
    }
    return result;
}

function normalize1d(x) {
    const ord = 2;
    const norm = tf.norm(x, ord);
    return x.div(norm);
}

function normalize2d(x) {
    const ord = 2;
    const axis = 1;
    const norms = tf.norm(x, ord, axis).expandDims(1);
    return x.div(norms);
}

async function predict(model, sample) {
    // FIXME Assumes NCC.
    let minDistance = Number.MAX_VALUE;
    let result;
    const emb = await getEmbedding(sample);
    Object.entries(model).forEach(([intent, centroidInfo]) => {
        const centroid = tf.tensor1d(centroidInfo.centroid);
        const distance = centroid.sub(emb).pow(2).sum();
        if (distance.less(minDistance).dataSync()[0]) {
            result = intent;
            minDistance = distance;
        }
    });
    return result;
}

async function evaluate(model) {
    const evalStats = [];
    const evalIntents = Object.entries(intents);

    for (let i = 0; i < evalIntents.length; ++i) {
        const [intent, expectedIntent] = evalIntents[i];
        const stats = {
            intent: expectedIntent,
            precision: undefined,
            numCorrect: 0,
            confusion: {},
        };

        const pathPrefix = path.join('test', intent);
        const dataDir = path.join(dataPath, pathPrefix);
        const samples = fs.readdirSync(dataDir);

        console.log(`Evaluating with ${samples.length} samples for ${intents[intent]}.`);

        for (let i = 0; i < samples.length; ++i) {
            if (i % 100 == 0) {
                console.log(`  ${expectedIntent}: ${(100 * i / samples.length).toFixed(1)}% (${i}/${samples.length})`);
            }
            const prediction = await predict(model, path.join(pathPrefix, samples[i]));
            if (prediction === expectedIntent) {
                stats.numCorrect += 1;
            } else {
                if (!(prediction in stats.confusion)) {
                    stats.confusion[prediction] = 0;
                }
                stats.confusion[prediction] += 1;
            }
        }
        stats.precision = stats.numCorrect / samples.length;
        evalStats.push(stats);
        console.log(`  ${expectedIntent}: Done evaluating.`);
    }
    console.log(`normalizeEachEmbedding: ${normalizeEachEmbedding}`);
    console.log(`normalizeCentroid: ${normalizeCentroid}`);
    console.log(JSON.stringify(evalStats, null, 2));
}

async function getCentroid(intent) {
    const pathPrefix = path.join('train', intent);
    const dataDir = path.join(dataPath, pathPrefix);
    const samples = fs.readdirSync(dataDir);

    console.log(`Training with ${samples.length} samples for ${intents[intent]}.`);

    const allEmbeddings = [];
    for (let i = 0; i < samples.length; ++i) {
        if (i % 100 == 0) {
            console.log(`  ${intents[intent]}: ${(100 * i / samples.length).toFixed(1)}% (${i}/${samples.length})`);
        }

        let emb = await getEmbedding(path.join(pathPrefix, samples[i]));
        allEmbeddings.push(emb);
    }
    console.log(`  ${intents[intent]}: Done getting embeddings.`);
    let allEmbTensor = tf.concat(allEmbeddings);

    if (allEmbTensor.shape[0] !== samples.length) {
        throw new Error(`Some embeddings are missing: allEmbTensor.shape[0] !== samples.length: ${allEmbTensor.shape[0]} !== ${samples.length}`);
    }
    let centroid = allEmbTensor.mean(axis = 0);
    if (normalizeCentroid) {
        centroid = normalize1d(centroid);
    }
    return {
        centroid: centroid.arraySync(),
        dataCount: samples.length,
    };
}

function getNearestCentroidModel() {
    return new Promise((resolve, reject) => {
        Promise.all(Object.keys(intents).map(getCentroid))
            .then(async centroidInfos => {
                const model = {};
                Object.values(intents).forEach((intent, i) => {
                    model[intent] = centroidInfos[i];
                });
                const path = `${__dirname}/classifier-centroids.json`;
                console.log(`Saving centroids to "${path}".`);
                fs.writeFileSync(path, JSON.stringify(model));
                resolve(model);
            }).catch(reject);
    });
}

function getPerceptronModel() {
    return new Promise((resolve, reject) => {
        // TODO
    });
}

async function main() {
    global.encoder = await mobilenet.load(
        {
            version: 2,
            alpha: 1,
        }
    );

    let model;
    switch (classifierType) {
        case 'ncc':
            model = await getNearestCentroidModel();
            break;
        case 'perceptron':
            break;
        default:
            break;
    }

    evaluate(model);

    fs.writeFile(embeddingCachePath, JSON.stringify(embeddingCache), (err) => {
        if (err) {
            console.error("Error writing embedding cache.");
            console.error(err);
        } else {
            console.debug(`Wrote embedding cache to \"${embeddingCachePath}\".`);
        }
    });
};

main();
