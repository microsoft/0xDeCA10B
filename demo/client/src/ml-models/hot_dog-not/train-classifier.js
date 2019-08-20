const fs = require('fs');
const path = require('path');

const mobilenet = require('@tensorflow-models/mobilenet');
const tf = require('@tensorflow/tfjs-node');
const { createCanvas, loadImage } = require('canvas');

const { normalize1d, normalize2d } = require('../tensor-utils');

const dataPath = path.join(__dirname, './seefood');

const positiveClass = "HOT_DOG";
const negativeClass = "NOT_HOT_DOG";
const intents = {
    'hot_dog': positiveClass,
    'not_hot_dog': negativeClass,
};

// Normalize each sample like what will happen in production to avoid changing the centroid by too much.
const normalizeEachEmbedding = false;

// Classifier type can be: ncc/perceptron
const classifierType = 'perceptron';

// Perceptron Classifier Config
let learningRate = 0.2;
const LEARNING_RATE_CHANGE_FACTOR = 0.618;
const LEARNING_RATE_CUTTING_PERCENT_OF_BEST = 0.618;
const MAX_STABILITY_COUNT = 3;
const classes = {
    [positiveClass]: +1,
    [negativeClass]: -1,
};

// Nearest Centroid Classifier Config
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

/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
// From https://stackoverflow.com/a/6274381/1226799
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

async function predict(model, sample) {
    switch (classifierType) {
        case 'ncc':
            return await predictNearestCentroidModel(model, sample);
        case 'perceptron':
            return await predictPerceptron(model, sample);
        default:
            throw new Error(`Unrecognized classifierType: "${classifierType}"`);
    }
}

async function evaluate(model) {
    const evalStats = [];
    const evalIntents = Object.entries(intents);
    let precisionHarmonicMean = 0;

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
            if (i % Math.round(samples.length / 5) == 0) {
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
        precisionHarmonicMean += 1 / stats.precision;
        evalStats.push(stats);
        console.log(`  ${expectedIntent}: Done evaluating.`);
    }
    console.log(`normalizeEachEmbedding: ${normalizeEachEmbedding}`);
    switch (classifierType) {
        case 'ncc':
            console.log(`normalizeCentroid: ${normalizeCentroid}`);
            break;
        case 'perceptron':
            console.log(`learningRate: ${learningRate}`);
            break;
        default:
            throw new Error(`Unrecognized classifierType: "${classifierType}"`);
    }
    console.log(JSON.stringify(evalStats, null, 2));
    precisionHarmonicMean = evalStats.length / precisionHarmonicMean;
    console.log(`precision harmonic mean: ${precisionHarmonicMean.toFixed(2)}`);
}

// Nearest Centroid Classifier Section

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

        const emb = await getEmbedding(path.join(pathPrefix, samples[i]));
        allEmbeddings.push(emb);
    }
    console.log(`  ${intents[intent]}: Done getting embeddings.`);
    const centroid = tf.tidy(() => {
        const allEmbTensor = tf.concat(allEmbeddings);

        if (allEmbTensor.shape[0] !== samples.length) {
            throw new Error(`Some embeddings are missing: allEmbTensor.shape[0] !== samples.length: ${allEmbTensor.shape[0]} !== ${samples.length}`);
        }
        let centroid = allEmbTensor.mean(axis = 0);
        if (normalizeCentroid) {
            centroid = normalize1d(centroid);
        }
        return centroid.arraySync();
    });
    allEmbeddings.forEach(emb => emb.dispose());
    return {
        centroid,
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
                const modelPath = path.join(__dirname, 'classifier-centroids.json');
                console.log(`Saving centroids to "${modelPath}".`);
                fs.writeFileSync(modelPath, JSON.stringify(model));
                resolve(model);
            }).catch(reject);
    });
}

async function predictNearestCentroidModel(model, sample) {
    let minDistance = Number.MAX_VALUE;
    let result;
    const emb = await getEmbedding(sample);
    tf.tidy(() => {
        Object.entries(model).forEach(([intent, centroidInfo]) => {
            const centroid = tf.tensor1d(centroidInfo.centroid);
            const distance = centroid.sub(emb).pow(2).sum();
            if (distance.less(minDistance).dataSync()[0]) {
                result = intent;
                minDistance = distance;
            }
        });
    });
    emb.dispose();
    return result;
}

// Perceptron Section

async function getPerceptronModel() {
    return new Promise(async (resolve, reject) => {
        // Load data.
        const samples = [];
        Object.keys(intents).forEach(intent => {
            const pathPrefix = path.join('train', intent);
            const dataDir = path.join(dataPath, pathPrefix);
            const samplesForClass = fs.readdirSync(dataDir).map(sample => {
                return {
                    classification: intents[intent],
                    path: path.join(pathPrefix, sample)
                }
            });
            samples.push(...samplesForClass);
        });

        const model = {
            weights: undefined,
            bias: 0,
        }

        let numUpdates, bestNumUpdatesBeforeLearningRateChange;
        let epoch = 0;
        let stabilityCount = 0;
        do {
            numUpdates = 0;
            shuffle(samples);
            for (let i = 0; i < samples.length; ++i) {
                if (i % Math.round(samples.length / 4) == 0) {
                    // console.log(`  training: ${(100 * i / samples.length).toFixed(1)}% (${i}/${samples.length})`);
                }
                const sample = samples[i];
                const emb = await getEmbedding(sample.path);
                const { classification } = sample;

                if (model.weights === undefined) {
                    // Initialize the weights.
                    model.weights = new Array(emb.shape[1]);
                    for (let j = 0; j < model.weights.length; ++j) {
                        model.weights[j] = Math.random() - 0.5;
                    }
                    model.weights = tf.tensor1d(model.weights);
                    model.weights = normalize1d(model.weights);
                }
                const prediction = await predictPerceptron(model, emb);
                if (prediction !== classification) {
                    numUpdates += 1;
                    const sign = classes[classification];
                    model.weights = model.weights.add(emb.gather(0).mul(sign * learningRate));
                }
                emb.dispose();
            }
            console.log(`Training epoch: ${epoch.toString().padStart(4, '0')}: numUpdates: ${numUpdates}`);
            epoch += 1;
            if (bestNumUpdatesBeforeLearningRateChange !== undefined &&
                numUpdates < bestNumUpdatesBeforeLearningRateChange * LEARNING_RATE_CUTTING_PERCENT_OF_BEST) {
                learningRate *= LEARNING_RATE_CHANGE_FACTOR;
                console.log(`Changed learning rate to: ${learningRate.toFixed(3)}`);
                bestNumUpdatesBeforeLearningRateChange = numUpdates;
            }
            if (bestNumUpdatesBeforeLearningRateChange === undefined) {
                bestNumUpdatesBeforeLearningRateChange = numUpdates;
            }

            if (numUpdates < Math.max(samples.length * 0.01, 1)) {
                stabilityCount += 1;
            } else {
                stabilityCount = 0;
            }
        } while (stabilityCount < MAX_STABILITY_COUNT);
        const modelPath = path.join(__dirname, 'classifier-perceptron.json');
        console.log(`Saving Perceptron to "${modelPath}".`);
        fs.writeFileSync(modelPath, JSON.stringify({
            weights: model.weights.arraySync(),
            bias: model.bias
        }));
        resolve(model);
    });
}

async function predictPerceptron(model, sample) {
    let result;
    let emb = sample;
    if (typeof sample === 'string') {
        emb = await getEmbedding(sample);
    }
    tf.tidy(() => {
        let prediction = model.weights.dot(emb.gather(0));
        prediction = prediction.add(model.bias);
        if (prediction.greater(0).dataSync()[0]) {
            result = positiveClass;
        } else {
            result = negativeClass;
        }
    });
    if (typeof sample === 'string') {
        emb.dispose();
    }
    return result;
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
            model = await getPerceptronModel();
            break;
        default:
            throw new Error(`Unrecognized classifierType: "${classifierType}"`);
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
