const fs = require('fs');
const path = require('path');

const mobilenet = require('@tensorflow-models/mobilenet');
const tf = require('@tensorflow/tfjs-node');
const { createCanvas, loadImage } = require('canvas');

const { normalize1d } = require('../tensor-utils');

const dataPath = path.join(__dirname, './seefood');

const POSITIVE_CLASS = "HOT DOG";
const NEGATIVE_CLASS = "NOT HOT DOG";
const INTENTS = {
    'hot_dog': POSITIVE_CLASS,
    'not_hot_dog': NEGATIVE_CLASS,
};

// Normalize each sample like what will happen in production to avoid changing the centroid by too much.
const NORMALIZE_EACH_EMBEDDING = true;

// Reduce the size of the embeddings.
const REDUCE_EMBEDDINGS = false;
const EMB_SIZE = 1280;
const EMB_REDUCTION_FACTOR = REDUCE_EMBEDDINGS ? 4 : 1;

// Classifier type can be: ncc/perceptron
const CLASSIFIER_TYPE = 'perceptron';

// Perceptron Classifier Config

// Take only the top features.
const PERCEPTRON_NUM_FEATS = 400;

// Sort of like regularization but it does not converge.
// Probably because it ruins the Perceptron assumption of updating weights.
const NORMALIZE_PERCEPTRON_WEIGHTS = false;

let learningRate = 1;
const LEARNING_RATE_CHANGE_FACTOR = 0.8618;
const LEARNING_RATE_CUTTING_PERCENT_OF_BEST = 0.8618;
const MAX_STABILITY_COUNT = 3;
const PERCENT_OF_TRAINING_SET_TO_FIT = 0.99;
const classes = {
    [POSITIVE_CLASS]: +1,
    [NEGATIVE_CLASS]: -1,
};

// Nearest Centroid Classifier Config
// Normalizing the centroid didn't change performance by much.
// It was slightly worse for HOT_DOG accuracy.
const NORMALIZE_CENTROID = false;

let embeddingCache;
const embeddingCachePath = path.join(__dirname, 'embedding_cache.json');
if (fs.existsSync(embeddingCachePath)) {
    try {
        embeddingCache = fs.readFileSync(embeddingCachePath, 'utf8');
        embeddingCache = JSON.parse(embeddingCache);
        console.debug(`Loaded ${Object.keys(embeddingCache).length} cached embeddings.`);
    } catch (error) {
        console.error("Error loading embedding cache.\nWill create a new one.");
        console.error(error);
        embeddingCache = {};
    }
} else {
    embeddingCache = {};
}

// Useful for making the embedding smaller.
// This did not change the accuracy by much.
if (EMB_SIZE % EMB_REDUCTION_FACTOR !== 0) {
    throw new Error("The embedding reduction factor is not a multiple of the embedding size.");
}
const EMB_MAPPER =
    tf.tidy(_ => {
        const mapper = tf.fill([EMB_SIZE / EMB_REDUCTION_FACTOR, EMB_SIZE], 0, 'int32');
        const buffer = mapper.bufferSync();
        for (let i = 0; i < mapper.shape[0]; ++i) {
            for (let j = 0; j < EMB_REDUCTION_FACTOR; ++j) {
                buffer.set(1, i, 2 * i + j);
            }
        }
        return buffer.toTensor();
    });

/**
 * @param {string} sample The relative path from `dataPath` for the image.
 * @returns The embedding for the image. Shape has 1 dimension.
 */
async function getEmbedding(sample) {
    let result = embeddingCache[sample];
    if (result !== undefined) {
        result = tf.tensor1d(result);
    } else {
        const img = await loadImage(path.join(dataPath, sample));
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const emb = await encoder.infer(canvas, { embedding: true });
        if (emb.shape[1] !== EMB_SIZE) {
            throw new Error(`Expected embedding to have ${EMB_SIZE} dimensions. Got shape: ${emb.shape}.`);
        }
        result = tf.tidy(_ => {
            let result = emb.gather(0);
            embeddingCache[sample] = result.arraySync();
            if (REDUCE_EMBEDDINGS) {
                result = EMB_MAPPER.dot(result);
            }
            return result;
        });
        emb.dispose();
    }
    if (NORMALIZE_EACH_EMBEDDING) {
        const normalizedResult = normalize1d(result);
        result.dispose();
        result = normalizedResult;
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
    switch (CLASSIFIER_TYPE) {
        case 'ncc':
            return await predictNearestCentroidModel(model, sample);
        case 'perceptron':
            return await predictPerceptron(model, sample);
        default:
            throw new Error(`Unrecognized classifierType: "${CLASSIFIER_TYPE}"`);
    }
}

async function evaluate(model) {
    const evalStats = [];
    const evalIntents = Object.entries(INTENTS);

    for (let i = 0; i < evalIntents.length; ++i) {
        const [intent, expectedIntent] = evalIntents[i];
        const stats = {
            intent: expectedIntent,
            recall: undefined,
            numCorrect: 0,
            confusion: {},
        };

        const pathPrefix = path.join('test', intent);
        const dataDir = path.join(dataPath, pathPrefix);
        const samples = fs.readdirSync(dataDir);

        console.log(`Evaluating with ${samples.length} samples for ${INTENTS[intent]}.`);

        for (let i = 0; i < samples.length; ++i) {
            if (i % Math.round(samples.length / 5) == 0) {
                // console.log(`  ${expectedIntent}: ${(100 * i / samples.length).toFixed(1)}% (${i}/${samples.length})`);
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
        stats.recall = stats.numCorrect / samples.length;
        evalStats.push(stats);
        // console.log(`  ${expectedIntent}: Done evaluating.`);
    }
    console.log(`NORMALIZE_EACH_EMBEDDING: ${NORMALIZE_EACH_EMBEDDING}`);
    console.log(`NORMALIZE_PERCEPTRON_WEIGHTS: ${NORMALIZE_PERCEPTRON_WEIGHTS}`);
    switch (CLASSIFIER_TYPE) {
        case 'ncc':
            console.log(`normalizeCentroid: ${NORMALIZE_CENTROID}`);
            break;
        case 'perceptron':
            console.log(`learningRate: ${learningRate}`);
            break;
        default:
            throw new Error(`Unrecognized classifierType: "${CLASSIFIER_TYPE}"`);
    }
    // Compute precision.
    Object.values(INTENTS).forEach(intent => {
        evalStats.forEach(stats => {
            if (stats.intent === intent) {
                let numFalsePositives = 0;
                evalStats.forEach(otherStats => {
                    if (otherStats.intent !== intent) {
                        if (otherStats.confusion[intent] !== undefined) {
                            numFalsePositives += otherStats.confusion[intent];
                        }
                    }
                });
                stats.precision = stats.numCorrect / (stats.numCorrect + numFalsePositives);
                stats.f1 = 2 / (1 / stats.precision + 1 / stats.recall);
            }
        });
    })
    console.log(JSON.stringify(evalStats, null, 2));
    let f1HarmonicMean = 0;
    for (let i = 0; i < evalStats.length; ++i) {
        f1HarmonicMean += 1 / evalStats[i].f1;
    }
    f1HarmonicMean = evalStats.length / f1HarmonicMean;
    console.log(`f1 harmonic mean: ${f1HarmonicMean.toFixed(3)}`);
}

// Nearest Centroid Classifier Section

async function getCentroid(intent) {
    const pathPrefix = path.join('train', intent);
    const dataDir = path.join(dataPath, pathPrefix);
    const samples = fs.readdirSync(dataDir);

    console.log(`Training with ${samples.length} samples for ${INTENTS[intent]}.`);

    const allEmbeddings = [];
    for (let i = 0; i < samples.length; ++i) {
        if (i % 100 == 0) {
            console.log(`  ${INTENTS[intent]}: ${(100 * i / samples.length).toFixed(1)}% (${i}/${samples.length})`);
        }

        const emb = await getEmbedding(path.join(pathPrefix, samples[i]));
        allEmbeddings.push(emb.expandDims());
    }
    console.log(`  ${INTENTS[intent]}: Done getting embeddings.`);
    const centroid = tf.tidy(() => {
        const allEmbTensor = tf.concat(allEmbeddings);

        if (allEmbTensor.shape[0] !== samples.length) {
            throw new Error(`Some embeddings are missing: allEmbTensor.shape[0] !== samples.length: ${allEmbTensor.shape[0]} !== ${samples.length}`);
        }
        let centroid = allEmbTensor.mean(axis = 0);
        if (NORMALIZE_CENTROID) {
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
        Promise.all(Object.keys(INTENTS).map(getCentroid))
            .then(async centroidInfos => {
                const model = {};
                Object.values(INTENTS).forEach((intent, i) => {
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
        Object.keys(INTENTS).forEach(intent => {
            const pathPrefix = path.join('train', intent);
            const dataDir = path.join(dataPath, pathPrefix);
            const samplesForClass = fs.readdirSync(dataDir).map(sample => {
                return {
                    classification: INTENTS[intent],
                    path: path.join(pathPrefix, sample)
                }
            });
            samples.push(...samplesForClass);
        });

        const model = {
            bias: 0,
        }

        // Initialize the weights.
        console.log(` Training with ${EMB_SIZE} weights.`);
        model.weights = new Array(EMB_SIZE);
        for (let j = 0; j < model.weights.length; ++j) {
            // Can initialize randomly with `Math.random() - 0.5` but it doesn't seem to make much of a difference.
            // model.weights[j] = 0;
            model.weights[j] = Math.random() - 0.5;
        }
        model.weights = tf.tidy(_ => {
            return normalize1d(tf.tensor1d(model.weights));
        });

        let numUpdates, bestNumUpdatesBeforeLearningRateChange;
        let epoch = 0;
        let stabilityCount = 0;
        do {
            if (model.weights !== undefined && NORMALIZE_PERCEPTRON_WEIGHTS) {
                // Sort of like regularization.
                model.weights = normalize1d(model.weights);
            }

            numUpdates = 0;
            shuffle(samples);
            for (let i = 0; i < samples.length; ++i) {
                if (i % Math.round(samples.length / 4) == 0) {
                    // console.log(`  training: ${(100 * i / samples.length).toFixed(1)}% (${i}/${samples.length})`);
                }
                const sample = samples[i];
                const emb = await getEmbedding(sample.path);
                const { classification } = sample;

                const prediction = await predictPerceptron(model, emb);
                if (prediction !== classification) {
                    numUpdates += 1;
                    const sign = classes[classification];
                    model.weights = tf.tidy(_ => { return model.weights.add(emb.mul(sign * learningRate)); });
                }
                emb.dispose();
            }
            console.log(`Training epoch: ${epoch.toString().padStart(4, '0')}: numUpdates: ${numUpdates}`);
            if (numUpdates === 0) {
                // There cannot be any more updates.
                break
            }
            epoch += 1;
            if (bestNumUpdatesBeforeLearningRateChange !== undefined &&
                numUpdates < bestNumUpdatesBeforeLearningRateChange * LEARNING_RATE_CUTTING_PERCENT_OF_BEST) {
                learningRate *= LEARNING_RATE_CHANGE_FACTOR;
                console.debug(`  Changed learning rate to: ${learningRate.toFixed(3)}`);
                bestNumUpdatesBeforeLearningRateChange = numUpdates;
            }
            if (bestNumUpdatesBeforeLearningRateChange === undefined) {
                bestNumUpdatesBeforeLearningRateChange = numUpdates;
            }

            if (numUpdates < Math.max(samples.length * (1 - PERCENT_OF_TRAINING_SET_TO_FIT), 1)) {
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
        if (model.featureIndices !== undefined) {
            emb = emb.gather(model.featureIndices);
        }
        let prediction = model.weights.dot(emb);
        prediction = prediction.add(model.bias);
        if (prediction.greater(0).dataSync()[0]) {
            result = POSITIVE_CLASS;
        } else {
            result = NEGATIVE_CLASS;
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
    switch (CLASSIFIER_TYPE) {
        case 'ncc':
            model = await getNearestCentroidModel();
            break;
        case 'perceptron':
            model = await getPerceptronModel();
            break;
        default:
            throw new Error(`Unrecognized classifierType: "${CLASSIFIER_TYPE}"`);
    }

    await evaluate(model);

    fs.writeFileSync(embeddingCachePath, JSON.stringify(embeddingCache));
    console.debug(`Wrote embedding cache to \"${embeddingCachePath}\" with ${Object.keys(embeddingCache).length} cached embeddings.`);

    if (PERCEPTRON_NUM_FEATS !== EMB_SIZE) {
        console.log(`Reducing weights to ${PERCEPTRON_NUM_FEATS} dimensions.`)
        model.featureIndices = tf.tidy(_ => {
            return tf.abs(model.weights).topk(PERCEPTRON_NUM_FEATS).indices;
        });
        model.weights = tf.tidy(_ => {
            return model.weights.gather(model.featureIndices);
        });

        const modelPath = path.join(__dirname, `classifier-perceptron-${PERCEPTRON_NUM_FEATS}.json`);
        console.log(`Saving Perceptron with ${PERCEPTRON_NUM_FEATS} weights to "${modelPath}".`);
        fs.writeFileSync(modelPath, JSON.stringify({
            featureIndices: model.featureIndices.arraySync(),
            weights: model.weights.arraySync(),
            bias: model.bias
        }));

        await evaluate(model);
    }
};

main();
