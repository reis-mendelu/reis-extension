/**
 * Success Rate API Client
 * 
 * Fetches success rates from the server API.
 * No more local DOM scraping - server handles everything.
 */

import { StorageService, STORAGE_KEYS } from "../services/storage";
import type { SubjectSuccessRate, SuccessRateData } from "../types/documents";

const API_URL = "https://reismendelu.app/api/success-rates";
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Retrieves success rates from local storage.
 */
export function getStoredSuccessRates(): SuccessRateData | null {
    return StorageService.get<SuccessRateData>(STORAGE_KEYS.SUCCESS_RATES_DATA);
}

/**
 * Saves success rates to local storage.
 */
export function saveSuccessRates(data: SuccessRateData): void {
    StorageService.set(STORAGE_KEYS.SUCCESS_RATES_DATA, data);
}

/**
 * Check if cache is still valid for a given course code.
 */
function isCacheValid(courseCode: string): boolean {
    const lastSync = StorageService.get<Record<string, number>>(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC) || {};
    const lastSyncTime = lastSync[courseCode];
    if (!lastSyncTime) return false;
    return (Date.now() - lastSyncTime) < CACHE_EXPIRY;
}

/**
 * Mark a course code as synced.
 */
function markAsSynced(courseCodes: string[]): void {
    const lastSync = StorageService.get<Record<string, number>>(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC) || {};
    const now = Date.now();
    for (const code of courseCodes) {
        lastSync[code] = now;
    }
    StorageService.set(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC, lastSync);
}

/**
 * Fetches success rates for the given list of target course codes.
 * Returns a SuccessRateData object and saves it to storage.
 */
export async function fetchSubjectSuccessRates(targetCodes: string[]): Promise<SuccessRateData> {
    console.log(`[SuccessRate] Fetching ${targetCodes.length} courses from API...`);
    
    // 1. Check cache for each code
    const existing = getStoredSuccessRates();
    const results: Record<string, SubjectSuccessRate> = { ...(existing?.data || {}) };
    
    const codesToFetch = targetCodes.filter(code => {
        const hasCached = results[code] && results[code].stats.length > 0;
        const cacheValid = isCacheValid(code);
        return !hasCached || !cacheValid;
    });

    if (codesToFetch.length === 0) {
        console.log('[SuccessRate] All codes found in valid cache');
        return { lastUpdated: existing?.lastUpdated || new Date().toISOString(), data: results };
    }

    console.log(`[SuccessRate] Fetching ${codesToFetch.length} codes from API: ${codesToFetch.join(', ')}`);

    // 2. Fetch from API
    try {
        const response = await fetch(`${API_URL}?codes=${codesToFetch.join(',')}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const apiData = await response.json() as SuccessRateData;
        
        // 3. Merge with existing cache
        for (const [code, data] of Object.entries(apiData.data)) {
            results[code] = data;
        }

        // 4. Mark fetched codes as synced
        markAsSynced(codesToFetch);

        const finalResult: SuccessRateData = {
            lastUpdated: apiData.lastUpdated || new Date().toISOString(),
            data: results
        };

        // 5. Save to storage
        saveSuccessRates(finalResult);
        console.log(`[SuccessRate] Cached ${Object.keys(apiData.data).length} courses from API`);

        return finalResult;
    } catch (error) {
        console.error('[SuccessRate] API fetch failed:', error);
        // Return whatever we have cached
        return { lastUpdated: new Date().toISOString(), data: results };
    }
}

/**
 * Fetch global success rates (legacy compat - now just calls main function)
 */
export async function fetchGlobalSuccessRates(): Promise<SuccessRateData | null> {
    // This is now a no-op since we fetch on-demand per course
    // Kept for backwards compatibility
    return getStoredSuccessRates();
}
