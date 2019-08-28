const assert = require('assert');

const tf = require('@tensorflow/tfjs-node');

const { normalize1d, normalize2d } = require('../tensor-utils-node');

describe('tensor-utils-node', () => {
    it('normalize1d', () => {
        tf.tidy(() => {
            let v = tf.tensor1d([1, 0, 0]);
            let normalized = normalize1d(v);
            let expected = v;
            assert.equal(normalized.equalStrict(expected).all().asScalar().dataSync()[0], 1);

            v = tf.tensor1d([1, 1, 1, 1]);
            normalized = normalize1d(v);
            expected = tf.tensor1d([1 / 2, 1 / 2, 1 / 2, 1 / 2]);
            assert.equal(normalized.equalStrict(expected).all().asScalar().dataSync()[0], 1);
        });
    })

    it('normalize1d 0-vector', () => {
        tf.tidy(() => {
            const zero = tf.tensor1d([0, 0, 0]);
            const normalized = normalize1d(zero);
            assert.equal(normalized.equalStrict(zero).all().asScalar().dataSync()[0], 1);
        });
    })

    it('normalize2d', () => {
        tf.tidy(() => {
            let m = tf.tensor2d([
                [1, 0, 0, 0],
                [1, 1, 1, 1],
            ]);
            let normalized = normalize2d(m);
            let expected = tf.tensor2d([
                [1, 0, 0, 0],
                [1 / 2, 1 / 2, 1 / 2, 1 / 2]
            ]);
            assert.equal(normalized.equalStrict(expected).all().dataSync()[0], 1);
        });
    })
});
