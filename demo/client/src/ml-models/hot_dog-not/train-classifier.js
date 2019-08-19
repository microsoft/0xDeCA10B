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

// Normalize each sample like what will happen in production to avoid changing the centroid by too much.
const normalizeEachEmbedding = false;
// Normalizing the centroid didn't change performance.
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
        result = result;
        embeddingCache[sample] = result.gather(0).arraySync();
    }
    if (normalizeEachEmbedding) {
        result = normalize1d(result);
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

async function predict(model, query) {
    let minDistance = Number.MAX_VALUE;
    let result;
    const emb = await getEmbedding(query);
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

async function evaluate(intents, model) {
    // FIXME
    const evalStats = [];
    const evalIntents = Object.entries(intents);
    for (let i = 0; i < evalIntents.length; ++i) {
        const [intent, expectedIntent] = evalIntents[i];
        const filename = `train_${intent}_full.json`;
        let data = fs.readFileSync(path.join(dataPath, intent, filename), 'utf8');
        data = JSON.parse(data)[intent];

        const queries = data.map(datum => datum.data.map(o => o.text).join(""));
        console.log(`${expectedIntent}: Evaluating with ${queries.length} samples.`);
        const stats = {
            intent: expectedIntent,
            precision: undefined,
            numCorrect: 0,
            confusion: {},
        };
        for (let i = 0; i < queries.length; ++i) {
            const query = queries[i];
            const prediction = await predict(model, query);
            if (prediction === expectedIntent) {
                stats.numCorrect += 1;
            } else {
                if (!(prediction in stats.confusion)) {
                    stats.confusion[prediction] = 0;
                }
                stats.confusion[prediction] += 1;
            }
        }
        stats.precision = stats.numCorrect / queries.length;
        evalStats.push(stats);
    }
    console.log(`normalizeEachEmbedding: ${normalizeEachEmbedding}`);
    console.log(`normalizeCentroid: ${normalizeCentroid}`);
    console.log(JSON.stringify(evalStats, null, 2));
}

async function main() {
    // The code for the encoder gives too many warnings.
    // tf.disableDeprecationWarnings();

    global.encoder = await mobilenet.load(
        {
            version: 2,
            alpha: 1,
        }
    );

    async function getCentroid(intent) {
        const pathPrefix = path.join('train', intent)
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
        const allEmbTensor = tf.concat(allEmbeddings);
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

    Promise.all(Object.keys(intents).map(getCentroid))
        .then(async centroidInfos => {
            const model = {};
            Object.values(intents).forEach((intent, i) => {
                model[intent] = centroidInfos[i];
            });
            const path = `${__dirname}/classifier-centroids.json`;
            console.log(`Saving centroids to "${path}".`);
            fs.writeFileSync(path, JSON.stringify(model));

            // evaluate(intents, model);

            fs.writeFile(embeddingCachePath, JSON.stringify(embeddingCache), (err) => {
                if (err) {
                    console.error("Error writing embedding cache.");
                    console.error(err);
                } else {
                    console.debug(`Wrote embedding cache to \"${embeddingCachePath}\".`);
                }
            });
        });
};

main();
