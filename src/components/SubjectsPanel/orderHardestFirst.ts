/**
 * The order the enrolled subjects are shown in: hardest first, finished last.
 *
 * A pure rule rather than a `sort` in each component, because two surfaces ask
 * the same question — the desktop panel's "Aktuálně zapsáno" and the phone's
 * semester card — and `selectEnrolledNow` exists precisely because those two
 * disagreeing has been a reported bug before.
 *
 * Three decisions live here:
 *
 * 1. Unfinished subjects rank by average fail rate, descending. The number was
 *    already on every row; ordering by it is what turns a list into a ranking,
 *    so the subject most likely to cost a student their semester leads instead
 *    of sitting wherever the study plan happened to put it.
 * 2. A MISSING rate sorts last among the unfinished, not as a zero.
 *    `computeFailRate` returns null under ten results, so absence means "not
 *    enough data" — ranking that as the easiest subject on screen would be a
 *    claim the data does not support.
 * 3. Finished subjects go after all of them, keeping their own order. They are
 *    history, and their rate is deliberately not drawn (a rate is a forecast),
 *    so ranking them by an invisible number would shuffle rows for no reason a
 *    reader could see.
 *
 * Ties keep the plan's order: `sort` is stable, and the plan's order is the
 * only other meaningful one here.
 */
export function orderHardestFirst<T>(
  items: readonly T[],
  rateOf: (item: T) => number | null | undefined,
  isDone: (item: T) => boolean
): T[] {
  const unfinished = items.filter((i) => !isDone(i));
  const finished = items.filter(isDone);
  // -1, so "no rate" lands below a subject measured at 0 %: one is an absence
  // of data and the other is data.
  const rank = (i: T) => rateOf(i) ?? -1;
  return [...unfinished.sort((a, b) => rank(b) - rank(a)), ...finished];
}
