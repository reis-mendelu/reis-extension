/**
 * Per-resource freshness for one sync run.
 *
 * A full `syncAllData` is ~120 IS requests, and most of what it re-downloads
 * cannot have changed: a syllabus, a study plan and a classmate list move once
 * a semester, yet they were fetched on the same cadence as grades. This module
 * is the volatility gate — each resource declares how long its last value
 * stays good, and a run fetches only what is actually due.
 *
 * The stamps live in memory, deliberately. A fresh content script (new tab,
 * page navigation, app boot) starts with an empty map and therefore performs
 * one complete crawl, exactly as before; the saving is on the runs after it.
 * Persisting the stamps would mean trusting that some other context hydrated
 * the data, and a wrong guess there shows the student an empty screen.
 */

/** How long each tier's value stays good. */
export const TTL = {
  /** Genuinely volatile — grades, submissions, exam terms. Never skipped. */
  HOT: 0,
  /** Course material listings. Long enough to stop per-tick crawls, short
   *  enough that the Drive backup still mirrors new files the same day. */
  FILES: 3 * 60 * 60 * 1000,
  /** Moves at most once a day — attendance, study statistics, enrolment. */
  DAILY: 6 * 60 * 60 * 1000,
  /** Fixed for the term — syllabi, study plan, classmates, schedule. */
  SEMESTER: 24 * 60 * 60 * 1000,
} as const;

const fetchedAt = new Map<string, number>();

export function isFresh(key: string, ttlMs: number, now: number = Date.now()): boolean {
  if (ttlMs <= 0) return false; // hot tier — always due
  const stamp = fetchedAt.get(key);
  return stamp !== undefined && now - stamp < ttlMs;
}

export function markFetched(key: string, now: number = Date.now()): void {
  fetchedAt.set(key, now);
}

/** Makes every resource due again. The explicit-refresh path: when the student
 *  asks for fresh data, no TTL may answer on IS's behalf. */
export function resetSyncTtl(): void {
  fetchedAt.clear();
}

/**
 * A result worth counting as a completed fetch.
 *
 * Mirrors how `syncAllData` already decides whether to overwrite `cachedData`:
 * it keeps the previous value for a null result or an empty list, because both
 * are what a failed parse or a lapsed session return. Marking those fetched
 * would let one bad run blank a resource for its whole TTL window.
 */
function isUseful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Run `fetch` only when `key` is due, and stamp it when the result is worth
 * keeping. Returns `null` for a skip — which every call site in `syncAllData`
 * already treats as "keep what is cached", so a skip needs no new branch.
 *
 * `hasCached` is the safety half: a resource is skipped only when this context
 * already holds its value AND the stamp is young. Freshness alone is never
 * enough, so a skip can never leave a surface with nothing to render.
 */
export async function ttlGated<T>(
  key: string,
  ttlMs: number,
  hasCached: boolean,
  fetch: () => Promise<T>
): Promise<T | null> {
  if (hasCached && isFresh(key, ttlMs)) return null;
  const value = await fetch();
  if (isUseful(value)) markFetched(key);
  return value;
}
