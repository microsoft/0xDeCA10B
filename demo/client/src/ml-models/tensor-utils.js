const tf = require('@tensorflow/tfjs-node');

exports.normalize1d = function (x) {
    return tf.tidy(_ => {
        if (!(x instanceof tf.Tensor)) {
            x = tf.tensor(x);
        }
        const ord = 2;
        const norm = tf.norm(x, ord);
        if (norm.dataSync()[0] === 0) {
            return x;
        }
        return x.div(norm);
    });
}

exports.normalize2d = function (x) {
    return tf.tidy(_ => {
        const ord = 2;
        const axis = 1;
        const norms = tf.norm(x, ord, axis).expandDims(1);
        return x.div(norms);
    });
}

exports.normalizeArray = function (data) {
    return tf.tidy(_ => {
        return exports.normalize1d(data).arraySync();
    });
}
