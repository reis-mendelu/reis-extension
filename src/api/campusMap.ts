import { IndexedDBService } from '../services/storage';
import { STORAGE_KEYS } from '../services/storage/keys';
import { loggers } from '../utils/logger';
import { logError } from '../utils/reportError';
import type { RoomsCollection } from '../types/campusMap';

const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

async function lastSync(buildingId: number): Promise<number | undefined> {
  const map = (await IndexedDBService.get('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC)) as Record<string, number> | undefined;
  return map?.[String(buildingId)];
}
async function markSynced(buildingId: number): Promise<void> {
  const map = ((await IndexedDBService.get('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC)) as Record<string, number>) || {};
  map[String(buildingId)] = Date.now();
  await IndexedDBService.set('meta', STORAGE_KEYS.MAP_ROOMS_LAST_SYNC, map);
}

export async function fetchBuildingRooms(buildingId: number): Promise<RoomsCollection | null> {
  const key = String(buildingId);
  const cached = (await IndexedDBService.get('map_rooms', key)) as RoomsCollection | undefined;
  const ts = await lastSync(buildingId);
  if (cached && ts && Date.now() - ts < CACHE_EXPIRY) return cached;

  try {
    const res = await fetch(`${CDN_BASE_URL}/map/rooms-${key}.geojson`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as RoomsCollection;
    await IndexedDBService.set('map_rooms', key, data);
    await markSynced(buildingId);
    return data;
  } catch (err) {
    logError('Api.fetchBuildingRooms', err);
    if (cached) return cached; // stale-but-usable
    loggers.api.error('[CampusMap] no cache fallback for building', key);
    return null;
  }
}
