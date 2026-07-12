/** Freshness math for the localhost real-data snapshot (public/dev-real-data.json). */

export const DAY_MS = 86_400_000;
export const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * Age of the snapshot in ms, preferring its `lastSync` field and falling back to
 * the file's mtime. Returns null when neither timestamp is known. Never negative.
 */
export function snapshotAgeMs(
  lastSync: number | undefined,
  fileMtimeMs: number | undefined,
  now: number = Date.now()
): number | null {
  const ts = typeof lastSync === 'number' && lastSync > 0 ? lastSync : fileMtimeMs;
  if (!ts) return null;
  return Math.max(0, now - ts);
}

/** Stale when the age is unknown (null) or at/beyond the max age. */
export function isStale(ageMs: number | null, maxAgeMs: number): boolean {
  return ageMs === null || ageMs >= maxAgeMs;
}

/** Max age in ms from REIS_SNAPSHOT_MAX_AGE_DAYS (default 7; 0 = always stale). */
export function maxAgeMsFromEnv(
  env: Record<string, string | undefined>,
  fallbackDays: number = DEFAULT_MAX_AGE_DAYS
): number {
  const raw = env.REIS_SNAPSHOT_MAX_AGE_DAYS;
  const n = raw !== undefined && raw !== '' ? Number(raw) : NaN;
  const days = Number.isFinite(n) ? n : fallbackDays;
  return days * DAY_MS;
}
