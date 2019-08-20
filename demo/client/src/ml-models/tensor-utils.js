const tf = require('@tensorflow/tfjs-node');

exports.normalize1d = function (x) {
    const ord = 2;
    const norm = tf.norm(x, ord);
    if (norm.dataSync()[0] === 0) {
        return x;
    }
    return x.div(norm);
}

exports.normalize2d = function (x) {
    const ord = 2;
    const axis = 1;
    const norms = tf.norm(x, ord, axis).expandDims(1);
    return x.div(norms);
}