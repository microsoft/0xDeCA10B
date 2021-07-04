// Basically the same as tensor-utils-node.js but made for front-end.
// There are fancier ways to share code for front-end and back-end
// but they all seemed too complicated and unreliable in all cases.

import * as tf from '@tensorflow/tfjs'

export function normalize1d(x) {
	return tf.tidy(_ => {
		if (!(x instanceof tf.Tensor)) {
			x = tf.tensor(x)
		}
		const ord = 2
		const norm = tf.norm(x, ord)
		if (norm.dataSync()[0] === 0) {
			return x
		}
		return x.div(norm)
	})
}

export function normalize2d(x) {
	return tf.tidy(_ => {
		const ord = 2
		const axis = 1
		const norms = tf.norm(x, ord, axis).expandDims(1)
		return x.div(norms)
	})
}

export function normalizeArray(data) {
	return tf.tidy(_ => {
		return normalize1d(data).arraySync()
	})
}
