global.fetch = require('node-fetch');
const UniversalSentenceEncoder = require('@tensorflow-models/universal-sentence-encoder');
const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const path = require('path');

const dataPath = '../../../nlu-benchmark/2017-06-custom-intent-engines'
const intents = {
    'GetWeather': "WEATHER_GET",
    'PlayMusic': "MUSIC_PLAY",
};

// Re-train with all data before deploying.
const trainSplit = 1;
// Normalize each sample like what will happen in production to avoid changing the centroid by too much.
const normalizeEachEmbedding = true;
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

async function getEmbedding(query) {
    let result = embeddingCache[query];
    if (result !== undefined) {
        result = tf.tensor1d(result);
    } else {
        const newEmbeddings = await sentenceEncoder.embed([query]);
        result = newEmbeddings.gather(0);
        embeddingCache[query] = result.arraySync();
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
    if (trainSplit == 1) {
        return;
    }
    const evalStats = [];
    const evalIntents = Object.entries(intents);
    for (let i = 0; i < evalIntents.length; ++i) {
        const [intent, expectedIntent] = evalIntents[i];
        const filename = `train_${intent}_full.json`;
        let data = fs.readFileSync(path.join(dataPath, intent, filename), 'utf8');
        data = JSON.parse(data)[intent];

        data = data.slice(Math.round(trainSplit * data.length));
        const queries = data.map(datum => datum.data.map(o => o.text).join(""));
        console.log(`${expectedIntent}: Evaluating with ${queries.length} samples.`);
        const stats = {
            intent: expectedIntent,
            recall: undefined,
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
        stats.recall = stats.numCorrect / queries.length;
        evalStats.push(stats);
    }
    console.log(`normalizeEachEmbedding: ${normalizeEachEmbedding}`);
    console.log(`normalizeCentroid: ${normalizeCentroid}`);
    console.log(JSON.stringify(evalStats, null, 2));
}

async function main() {
    const sentenceEncoder = await UniversalSentenceEncoder.load();
    // The code for the encoder gives too many warnings.
    tf.disableDeprecationWarnings();

    async function getCentroid(intent) {
        const filename = `train_${intent}_full.json`;
        let data = fs.readFileSync(path.join(dataPath, intent, filename), 'utf8');
        data = JSON.parse(data)[intent];

        console.log(`Found ${data.length} samples for ${intents[intent]}.`);
        if (trainSplit < 1) {
            data = data.slice(0, Math.round(trainSplit * data.length));
        }
        const queries = data.map(datum => datum.data.map(o => o.text).join(""));
        console.log(`  Training with ${queries.length} samples.`);

        const chunkSize = 128;
        const allEmbeddings = [];
        for (let i = 0; i < queries.length; i += chunkSize) {
            console.log(`  ${intents[intent]}: ${(100 * i / queries.length).toFixed(1)}% (${i}/${queries.length})`);
            const queriesNeedingEmbedding = [];
            const currentQueries = queries.slice(i, i + chunkSize);
            for (let j = 0; j < currentQueries.length; ++j) {
                const query = currentQueries[j];
                let emb = embeddingCache[query];
                if (emb !== undefined) {
                    emb = tf.tensor2d([emb]);
                    if (normalizeEachEmbedding) {
                        emb = normalize2d(emb);
                    }
                    allEmbeddings.push(emb);
                } else {
                    queriesNeedingEmbedding.push(query);
                }
            }
            if (queriesNeedingEmbedding.length > 0) {
                let newEmbeddings = await sentenceEncoder.embed(queriesNeedingEmbedding);
                const n = newEmbeddings.arraySync();
                for (let j = 0; j < queriesNeedingEmbedding.length; ++j) {
                    embeddingCache[queriesNeedingEmbedding[j]] = n[j];
                }

                if (normalizeEachEmbedding) {
                    newEmbeddings = normalize2d(newEmbeddings);
                }
                allEmbeddings.push(newEmbeddings);
            }
        }
        const allEmbTensor = tf.concat(allEmbeddings);
        if (allEmbTensor.shape[0] !== queries.length) {
            throw new Exception(`Some embeddings are missing: allEmbTensor.shape[0] !== queries.length: ${allEmbTensor.shape[0]} !== ${queries.length}`);
        }
        let centroid = allEmbTensor.mean(axis = 0);;
        if (normalizeCentroid) {
            centroid = normalize1d(centroid);
        }
        return {
            centroid: centroid.arraySync(),
            dataCount: queries.length,
        };
    }

    Promise.all(Object.keys(intents).map(getCentroid))
        .then(async centroidInfos => {
            const model = {};
            Object.values(intents).forEach((intent, i) => {
                model[intent] = centroidInfos[i];
            });
            const path = `${__dirname}/vpa-classifier-centroids.json`;
            console.log(`Saving centroids to "${path}".`);
            fs.writeFileSync(path, JSON.stringify(model));

            evaluate(intents, model);

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
