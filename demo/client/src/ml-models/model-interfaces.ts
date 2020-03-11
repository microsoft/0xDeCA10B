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
		type: 'nearest centroid classifier' | 'sparse nearest centroid classifier' | 'dense nearest centroid classifier',
		public centroids: { [key: string]: CentroidInfo },
	) {
		super(type)
	}
}

/**
 * Information for each centroid in a `{@link NearestCentroidModel}`.
 */
export class CentroidInfo {
	constructor(
		public centroid: number[],
		public dataCount: number,
	) {
	}
}

/**
 * A Perceptron where the data given for updating and predicting is dense.
 */
export class PerceptronModel extends Model {
	/**
	 * @param type The type of model.
	 * @param classifications The classifications supported by the model.
	 * @param weights The weights for the model.
	 * @param intercept The bias to add to the multiplication of the weights and the data.
	 * @param learningRate (Optional, defaults to 1). The amount of impact that new training data has to the weights.
	 * @param featureIndices (Optional, default means to use all features)
	 * The indices of the features to use from some well-known shared encoder.
	 */
	constructor(
		type: 'perceptron' | 'dense perceptron' | 'sparse perceptron',
		public classifications: string[],
		public weights: number[],
		public intercept: number,
		public learningRate?: number,
		public featureIndices?: number[],
	) {
		super(type)
	}
}
