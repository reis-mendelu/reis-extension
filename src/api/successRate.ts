/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Success Rate API Client
 * 
 * Fetches success rates from the server API.
 * No more local DOM scraping - server handles everything.
 */

import { STORAGE_KEYS, IndexedDBService } from "../services/storage";
import { loggers } from "../utils/logger";
import type { SubjectSuccessRate, SuccessRateData } from "../types/documents";

// JSDelivr CDN for GitHub-hosted data
// In development, you can run a local server: npx serve server/dist-data -l 8080
// and set CDN_BASE_URL = "http://localhost:8080"
const CDN_BASE_URL = "https://raw.githubusercontent.com/reis-mendelu/reis-data/main";
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
    await IndexedDBService.set('success_rates', 'current', data)
        .catch(err => loggers.api.error('[SuccessRate] IDB save failed:', err));
}

/**
 * Check if cache is still valid for a given course code.
 */
async function isCacheValid(courseCode: string): Promise<boolean> {
    const lastSync = await IndexedDBService.get('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC) as Record<string, number> || {};
    const lastSyncTime = lastSync[courseCode];
    if (!lastSyncTime) return false;
    return (Date.now() - lastSyncTime) < CACHE_EXPIRY;
}

/**
 * Mark a course code as synced.
 */
async function markAsSynced(courseCodes: string[]): Promise<void> {
    const lastSync = await IndexedDBService.get('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC) as Record<string, number> || {};
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
 */
export async function fetchSubjectSuccessRates(targetCodes: string[]): Promise<SuccessRateData> {
    loggers.api.info('[SuccessRate] Fetching from CDN...', targetCodes.length);
    
    // 1. Check cache for each code
    const existing = await getStoredSuccessRates();
    const results: Record<string, SubjectSuccessRate> = { ...(existing?.data || {}) };
    
    // We need to resolve which codes to fetch, handling async isCacheValid
    const fetchDecisions = await Promise.all(targetCodes.map(async (code) => {
        const cached = results[code];
        const hasCached = cached && cached.stats && cached.stats.length > 0;
        const cacheValid = await isCacheValid(code);
        
        // Force re-fetch if data is legacy or missing new schema fields
        const isLegacy = hasCached && (
            // Check 1: Missing sourceUrl (Old legacy)
            cached.stats.some(s => !s.sourceUrl) ||
            // Check 2: Missing 'type' field (New schema requirement)
            cached.stats.some(s => !s.type)
        );
        
        return (!hasCached || !cacheValid || isLegacy) ? code : null;
    }));

    const codesToFetch = fetchDecisions.filter((c): c is string => c !== null);

    if (codesToFetch.length === 0) {
        loggers.api.info('[SuccessRate] All codes found in valid cache');
        return { lastUpdated: existing?.lastUpdated || new Date().toISOString(), data: results };
    }

    loggers.api.info('[SuccessRate] Fetching codes from CDN:', codesToFetch.length);

    // 2. Fetch each course from CDN (parallel)
    const fetchPromises = codesToFetch.map(async (code) => {
        const url = `${CDN_BASE_URL}/subjects/${code}.json`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    loggers.api.warn('[SuccessRate] Course not found in CDN (404):', code);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json() as SubjectSuccessRate;
        } catch (error) {
            loggers.api.error('[SuccessRate] Failed to fetch:', code, error);
            return null;
        }
    });

    const fetchedData = await Promise.all(fetchPromises);
    
    // 3. Merge with existing cache
    const successfulCodes: string[] = [];
    codesToFetch.forEach((code, i) => {
        if (fetchedData[i]) {
            results[code] = fetchedData[i]!;
            successfulCodes.push(code);
        }
    });

    // 4. Mark fetched codes as synced
    if (successfulCodes.length > 0) {
        await markAsSynced(successfulCodes);
    }

    const finalResult: SuccessRateData = {
        lastUpdated: new Date().toISOString(),
        data: results
    };

    // 5. Save to storage
    await saveSuccessRates(finalResult);
    loggers.api.info('[SuccessRate] Cached courses from CDN:', successfulCodes.length, '/', codesToFetch.length);

    return finalResult;
}

/**
 * Fetch global success rates (legacy compat - now just calls main function)
 */
export async function fetchGlobalSuccessRates(): Promise<SuccessRateData | null> {
    // This is now a no-op since we fetch on-demand per course
    // Kept for backwards compatibility
    return await getStoredSuccessRates();
}
