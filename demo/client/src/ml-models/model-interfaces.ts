/**
 * The base class for a model to be deployed to a smart contract.
 */
export class Model {
	/**
	 * @param type The type of model.
	 */
	constructor(public type: 'naive bayes'
		| 'nearest centroid classifier' | 'sparse nearest centroid classifier' | 'dense nearest centroid classifier'
		| 'perceptron' | 'dense perceptron' | 'sparse perceptron') {
	}
}

/**
 * A Multinomial Naive Bayes classifier.
 */
export class NaiveBayesModel extends Model {
	/**
	 * @param type The type of model.
	 * @param classifications The classifications supported by the model.
	 * @param classCounts The number of occurrences of each class in the training data.
	 * @param featureCounts For each class, the number of times each feature occurs within that class.
	 * Each innermost list is a tuple of the feature index and the number of times that feature occurs within the class.
	 * For example: Class 0 has feature 3 13 times and feature 5 15 times. Class 1 has feature 8 18 times: [[[3, 13], [5, 15]], [8, 18]].
	 * @param totalNumFeatures The total number of features throughout all classes.
	 * @param smoothingFactor The smoothing factor (sometimes called alpha). Use 1 for Laplace smoothing.
	 */
	constructor(
		type: 'naive bayes',
		public classifications: string[],
		public classCounts: number[],
		public featureCounts: number[][][],
		public totalNumFeatures: number,
		public smoothingFactor: number,
	) {
		super(type)
	}
}

/**
 * A nearest centroid classifier that uses Euclidean distance to predict the closest centroid.
 *
 * https://en.wikipedia.org/wiki/Nearest_centroid_classifier
 */
export class NearestCentroidModel extends Model {
	/**
	 * @param type The type of model.
	 * @param centroids A mapping of the classification name to the centroid for that classification.
	 */
	constructor(
		type: 'nearest centroid classifier' | 'dense nearest centroid classifier',
		public centroids: { [classification: string]: CentroidInfo },
	) {
		super(type)
	}
}

/**
 * Information for each centroid in a `{@link NearestCentroidModel}`.
 */
export class CentroidInfo {
	/**
	 * @param centroid The average of all data points in the class.
	 * @param dataCount The number of samples in the class. 
	 */
	constructor(
		public centroid: number[],
		public dataCount: number,
	) {
	}
}

export class SparseNearestCentroidModel extends Model {
	/**
	 * @param type The type of model.
	 * @param centroids A mapping of the classification name to the centroid for that classification.
	 */
	constructor(
		type: 'sparse nearest centroid classifier',
		public centroids: { [classification: string]: SparseCentroidInfo },
	) {
		super(type)
	}
}

/**
 * Information for each centroid in a `{@link NearestCentroidModel}`.
 */
export class SparseCentroidInfo {
	/**
	 * @param centroid The average of all data points in the class.
	 * The feature indices should be integers but they are strings for convenience when loading from JSON.	 
	 * @param dataCount The number of samples in the class. 
	 */
	constructor(
		public centroid: { [featureIndex: string]: number },
		public dataCount: number,
	) {
	}
}

/**
 * A Perceptron where the data given for updating and predicting is dense.
 */
export class DensePerceptronModel extends Model {
	/**
	 * @param type The type of model. 'perceptron' defaults to a dense model.
	 * @param classifications The classifications supported by the model.
	 * @param weights The weights for the model. Can be used for dense or sparse models.
	 * @param intercept The bias to add to the multiplication of the weights and the data.
	 * @param learningRate (Optional, defaults to 1). The amount of impact that new training data has to the weights.
	 * @param featureIndices (Optional, default means to use all features)
	 * The indices of the features to use from some well-known shared encoder.
	 */
	constructor(
		type: 'perceptron' | 'dense perceptron',
		public classifications: string[],
		public weights: number[],
		public intercept: number,
		public learningRate?: number,
		public featureIndices?: number[],
	) {
		super(type)
	}
}

/**
 * A Perceptron where the data given for updating and predicting is dense.
 */
export class SparsePerceptronModel extends Model {
	/**
	 * @param type The type of model. 'perceptron' defaults to a dense model.
	 * @param classifications The classifications supported by the model.
	 * @param weights The weights for the model. Can be used for dense or sparse models.
	 * @param sparseWeights Additional weights indexed for a sparse model.
	 * The feature indices should be integers but they are strings for convenience when loading from JSON.
	 * @param intercept The bias to add to the multiplication of the weights and the data.
	 * @param learningRate (Optional, defaults to 1). The amount of impact that new training data has to the weights.
	 * @param featureIndices (Optional, default means to use all features)
	 * The indices of the features to use from some well-known shared encoder.
	 */
	constructor(
		type: 'sparse perceptron',
		public classifications: string[],
		public weights: number[],
		public sparseWeights: { [featureIndex: string]: number },
		public intercept: number,
		public learningRate?: number,
		public featureIndices?: number[],
	) {
		super(type)
	}
}
