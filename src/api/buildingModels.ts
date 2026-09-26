import { IndexedDBService } from '../services/storage';
import { logError } from '../utils/reportError';
import { buildingModelFile } from '../data/map/buildingModels';
import type { BuildingModel, BuildingModelMeta } from '../types/buildingModel';

// The same CDN and repository as the room outlines (campusMap.ts) — no new
// host, so nothing changes in privacy/disclosures.ts.
const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days, like the room outlines

async function download(file: string): Promise<BuildingModel> {
  const [glbRes, metaRes] = await Promise.all([
    fetch(`${CDN_BASE_URL}/map/3d/${file}.glb`),
    fetch(`${CDN_BASE_URL}/map/3d/${file}.json`),
  ]);
  if (!glbRes.ok) throw new Error(`glb HTTP ${glbRes.status}`);
  if (!metaRes.ok) throw new Error(`meta HTTP ${metaRes.status}`);
  const [glb, meta] = await Promise.all([
    glbRes.arrayBuffer(),
    metaRes.json() as Promise<BuildingModelMeta>,
  ]);
  return { glb, meta, fetchedAt: Date.now() };
}

/**
 * A building's 3D model for the building card, or null when it has none or it
 * cannot be had. Cache-first for 30 days; a failed refresh serves the stale
 * copy rather than dropping the card back to the flat plan.
 */
export async function fetchBuildingModel(buildingId: number): Promise<BuildingModel | null> {
  const file = buildingModelFile(buildingId);
  if (!file) return null;
  const key = String(buildingId);
  const cached = await IndexedDBService.get('map_models', key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_EXPIRY) return cached;
  try {
    const model = await download(file);
    await IndexedDBService.set('map_models', key, model);
    return model;
  } catch (err) {
    logError('Api.fetchBuildingModel', err, { buildingId });
    return cached ?? null;
  }
}
