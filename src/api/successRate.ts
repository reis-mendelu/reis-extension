/**
 * Success Rate API Client
 *
 * Fetches success rates from the server API.
 * No more local DOM scraping - server handles everything.
 */

import { STORAGE_KEYS, IndexedDBService } from '../services/storage';
import { loggers } from '../utils/logger';
import type { SubjectSuccessRate, SuccessRateData } from '../types/documents';

// CDN for GitHub-hosted data
export const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Retrieves success rates from local storage.
 */
export async function getStoredSuccessRates(): Promise<SuccessRateData | null> {
  const idbData = await IndexedDBService.get('success_rates', 'current');
  return idbData || null;
}

/**
 * Saves success rates to local storage.
 */
export async function saveSuccessRates(data: SuccessRateData): Promise<void> {
  await IndexedDBService.set('success_rates', 'current', data).catch((err) =>
    loggers.api.error('[SuccessRate] IDB save failed:', err)
  );
}

/**
 * Check if cache is still valid for a given course code.
 */
async function isCacheValid(courseCode: string): Promise<boolean> {
  const lastSync =
    ((await IndexedDBService.get('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC)) as Record<
      string,
      number
    >) || {};
  const lastSyncTime = lastSync[courseCode];
  if (!lastSyncTime) return false;
  return Date.now() - lastSyncTime < CACHE_EXPIRY;
}

/**
 * Was this entry fetched under an older reis-data version than `version`?
 * With no version known (meta.json never reached), nothing is stale — the
 * behaviour before versions existed.
 */
export function isStaleForVersion(
  entry: Pick<SubjectSuccessRate, 'cdnVersion'>,
  version: string | null
): boolean {
  return version !== null && entry.cdnVersion !== version;
}

/**
 * Mark a course code as synced.
 */
async function markAsSynced(courseCodes: string[]): Promise<void> {
  const lastSync =
    ((await IndexedDBService.get('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC)) as Record<
      string,
      number
    >) || {};
  const now = Date.now();
  for (const code of courseCodes) {
    lastSync[code] = now;
  }
  await IndexedDBService.set('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC, lastSync);
}

/**
 * Fetches success rates for the given list of target course codes.
 * Uses GitHub-hosted static JSON files via JSDelivr CDN.
 * Returns a SuccessRateData object and saves it to storage.
 *
 * `version` is the reis-data version from `ensureSuccessRateVersion`: a cached
 * entry stamped with any other version is fetched again, and what is fetched
 * is stamped with it.
 */
export async function fetchSubjectSuccessRates(
  targetCodes: string[],
  version: string | null = null
): Promise<SuccessRateData> {
  // 1. Check cache for each code
  const existing = await getStoredSuccessRates();
  const results: Record<string, SubjectSuccessRate> = { ...(existing?.data || {}) };

  // We need to resolve which codes to fetch, handling async isCacheValid
  const fetchDecisions = await Promise.all(
    targetCodes.map(async (code) => {
      const cached = results[code];
      const hasCached = cached && cached.stats && cached.stats.length > 0;
      const cacheValid = await isCacheValid(code);

      // Force re-fetch if data is legacy or missing new schema fields
      const isLegacy =
        hasCached &&
        // Check 1: Missing sourceUrl (Old legacy)
        (cached.stats.some((s) => !s.sourceUrl) ||
          // Check 2: Missing 'type' field (New schema requirement)
          cached.stats.some((s) => !s.type));

      const isStale = hasCached && isStaleForVersion(cached, version);

      return !hasCached || !cacheValid || isLegacy || isStale ? code : null;
    })
  );

  const codesToFetch = fetchDecisions.filter((c): c is string => c !== null);

  if (codesToFetch.length === 0) {
    return { lastUpdated: existing?.lastUpdated || new Date().toISOString(), data: results };
  }

  // 2. Fetch each course from CDN (parallel)
  const fetchPromises = codesToFetch.map(async (code) => {
    const url = `${CDN_BASE_URL}/subjects/${code}.json`;
    try {
      // jsDelivr sends max-age=604800, so a plain fetch can hand back a week-old
      // browser copy of a file that was just refreshed. 'no-cache' revalidates
      // (usually a 304 on the ETag). A `?v=` query would not help: the edge
      // ignores query strings.
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        if (response.status === 404) {
          // No file under this version: keep the cached data, but stamp it so it
          // is not asked for again until the version moves.
          const cached = results[code];
          return cached && version !== null ? { ...cached, cdnVersion: version } : null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const file = (await response.json()) as SubjectSuccessRate;
      return version === null ? file : { ...file, cdnVersion: version };
    } catch (error) {
      loggers.api.error('[SuccessRate] Failed to fetch:', code, error);
      return null;
    }
  });

  const fetchedData = await Promise.all(fetchPromises);

  // 3. Keep what was fetched
  const fetched: Record<string, SubjectSuccessRate> = {};
  codesToFetch.forEach((code, i) => {
    if (fetchedData[i]) fetched[code] = fetchedData[i]!;
  });

  // 4. Mark fetched codes as synced and save
  return persistFetched(fetched);
}

// Saves run one at a time, each merging only its own fetches onto what is
// stored *now*. Two batches run at once after every sync (`fetchSubjects` and
// `fetchStudyPlan`); writing back the snapshot each started from let the last
// one drop the other's codes, or put back a stale copy the other had replaced.
let persistChain: Promise<unknown> = Promise.resolve();

function persistFetched(fetched: Record<string, SubjectSuccessRate>): Promise<SuccessRateData> {
  const run = persistChain.then(async () => {
    const codes = Object.keys(fetched);
    if (codes.length > 0) await markAsSynced(codes);
    const latest = await getStoredSuccessRates();
    const merged: SuccessRateData = {
      lastUpdated: new Date().toISOString(),
      data: { ...(latest?.data || {}), ...fetched },
    };
    await saveSuccessRates(merged);
    return merged;
  });
  persistChain = run.catch(() => {});
  return run;
}

/**
 * Fetch global success rates (legacy compat - now just calls main function)
 */
export async function fetchGlobalSuccessRates(): Promise<SuccessRateData | null> {
  // This is now a no-op since we fetch on-demand per course
  // Kept for backwards compatibility
  return await getStoredSuccessRates();
}
