/**
 * Possible types of encoders.
 * These can be stored in smart contracts on public blockchains so do not make changes to the values.
 * Changing the casing of a value should be fine.
 */
export enum Encoder {
	// Simple encoders:
	None = "none",
	Mult1E9Round = "Multiply by 1E9, then round",

	// Hash encoders:
	MurmurHash3 = "MurmurHash3",

	// More complicated encoders:
	ImdbVocab = "IMDB vocab",
	MobileNetV2 = "MobileNetV2",
	USE = "universal sentence encoder",
}

export function normalizeEncoderName(encoderName: string) {
	return encoderName.toLocaleLowerCase('en')
}
