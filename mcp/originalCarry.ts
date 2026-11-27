// How the bytes mendelu_read_file downloaded reach the store without becoming part of the
// answer: they ride beside the answer object in a WeakMap, and storeMap.ts takes them when
// it saves that answer. Only the save knows the date the listing showed when the download
// began and the forget token of the call, so the original is kept under exactly those.
// Nothing here prints, counts or holds the bytes past the answer itself.

export type Original = { bytes: Uint8Array; filename?: string; mediaType?: string };

const carried = new WeakMap<object, Original>();

/** Attaches the downloaded bytes to the answer built from them; returns the answer. */
export function carry<T>(answer: T, original: Original): T {
  if (answer && typeof answer === 'object') carried.set(answer, original);
  return answer;
}

/** The bytes behind an answer, once: a second take returns nothing. */
export function takeOriginal(answer: unknown): Original | undefined {
  if (!answer || typeof answer !== 'object') return undefined;
  const o = carried.get(answer);
  carried.delete(answer);
  return o;
}
