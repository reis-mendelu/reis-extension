import { STORAGE_KEYS, IndexedDBService } from '../services/storage';
import { loggers } from '../utils/logger';
import type { ErasmusCountryData } from '../types/erasmus';

const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getStoredErasmusData(): Promise<ErasmusCountryData | null> {
  return await IndexedDBService.get('erasmus', 'current') || null;
}

async function isCacheValid(): Promise<boolean> {
  const lastSync = await IndexedDBService.get('meta', STORAGE_KEYS.ERASMUS_LAST_SYNC) as number | null;
  if (!lastSync) return false;
  return (Date.now() - lastSync) < CACHE_EXPIRY;
}

export async function fetchErasmusReports(): Promise<ErasmusCountryData | null> {
  const cached = await getStoredErasmusData();
  if (cached && await isCacheValid()) return cached;

  try {
    const url = `${CDN_BASE_URL}/erasmus/slovenia-study.json`;
    const res = await fetch(url);
    if (!res.ok) {
      loggers.api.error('[Erasmus] CDN fetch failed:', res.status);
      return cached;
    }
    const data = await res.json() as ErasmusCountryData;
    await IndexedDBService.set('erasmus', 'current', data);
    await IndexedDBService.set('meta', STORAGE_KEYS.ERASMUS_LAST_SYNC, Date.now());
    return data;
  } catch (err) {
    loggers.api.error('[Erasmus] Fetch failed:', err);
    return cached;
  }
}
