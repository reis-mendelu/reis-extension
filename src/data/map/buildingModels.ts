/**
 * Buildings that have a 3D model in reis-data (`map/3d/<file>.glb`), by map
 * building id. The pilot is Q alone — 23% of all weekly lesson slots — and the
 * next buildings are decided from how students use it, not added here by default.
 */
const BUILDING_MODEL_FILES: Readonly<Record<number, string>> = { 0: 'Q' };

export function buildingModelFile(buildingId: number): string | null {
  return BUILDING_MODEL_FILES[buildingId] ?? null;
}

export function hasBuildingModel(buildingId: number): boolean {
  return buildingModelFile(buildingId) !== null;
}
