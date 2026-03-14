import { STORAGE_KEYS, IndexedDBService } from '../services/storage';
import { loggers } from '../utils/logger';
import type { ErasmusCountryData } from '../types/erasmus';

const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKey(file: string): string {
  return `erasmus_${file}`;
}

function syncKey(file: string): string {
  return `${STORAGE_KEYS.ERASMUS_LAST_SYNC}_${file}`;
}

export async function getStoredErasmusData(file: string): Promise<ErasmusCountryData | null> {
  return await IndexedDBService.get('erasmus', cacheKey(file)) || null;
}

async function isCacheValid(file: string): Promise<boolean> {
  const lastSync = await IndexedDBService.get('meta', syncKey(file)) as number | null;
  if (!lastSync) return false;
  return (Date.now() - lastSync) < CACHE_EXPIRY;
}

export async function fetchErasmusReports(file: string): Promise<ErasmusCountryData | null> {
  const cached = await getStoredErasmusData(file);
  if (cached && await isCacheValid(file)) return cached;

  try {
    const url = `${CDN_BASE_URL}/erasmus/${file}`;
    const res = await fetch(url);
    if (!res.ok) {
      loggers.api.error('[Erasmus] CDN fetch failed:', res.status, file);
      return cached;
    }
    const data = await res.json() as ErasmusCountryData;
    await IndexedDBService.set('erasmus', cacheKey(file), data);
    await IndexedDBService.set('meta', syncKey(file), Date.now());
    return data;
  } catch (err) {
    loggers.api.error('[Erasmus] Fetch failed:', err);
    return cached;
  }
}
