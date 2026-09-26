import { IndexedDBService } from '../services/storage';
import { logError } from '../utils/reportError';
import { buildingModelFile } from '../data/map/buildingModels';
import { BuildingModelSchema } from '../types/schemas/mapModels.schema';
import type { BuildingModel, BuildingModelMeta } from '../types/buildingModel';

// The same CDN and repository as the room outlines (campusMap.ts) — no new
// host, so nothing changes in privacy/disclosures.ts.
// SPIKE (#462): a device build can pin the model to a reis-data commit that is
// not on main yet (`VITE_BUILDING_MODEL_REF=<sha>`), since a phone has no way to
// intercept requests the way the verify harness does.
const MODEL_REF = import.meta.env?.VITE_BUILDING_MODEL_REF || 'main';
const CDN_BASE_URL = `https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@${MODEL_REF}`;
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
  // Checked against the same schema the cache enforces: a malformed Q.json must
  // not reach the renderer. Throwing lets the caller fall back to the stale copy.
  const model = BuildingModelSchema.safeParse({ glb, meta, fetchedAt: Date.now() });
  if (!model.success) throw new Error(`meta invalid: ${model.error.issues[0]?.path.join('.')}`);
  return model.data;
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
