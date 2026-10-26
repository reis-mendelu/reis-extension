/**
 * Buildings that have a 3D model in reis-data (`map/3d/<file>.glb`), by map
 * building id. The pilot is Q alone — 23% of all weekly lesson slots — and the
 * next buildings are decided from how students use it, not added here by default.
 */
const BUILDING_MODEL_FILES: Readonly<Record<number, string>> = { 0: 'Q' };

/**
 * The 3D map — a room in Q tilts the map into the building — is OFF unless a
 * build asks for it with `VITE_MAP3D=1` (the dev server also takes `?map3d`).
 * Off, no building has a model: nothing fetches one, no 3D control renders and
 * three.js is never loaded. src/test/guards/map3dIsDormant.test.ts holds that.
 * Read per call, not at import, so a test can switch it with `vi.stubEnv`.
 */
export function map3dEnabled(): boolean {
  if (import.meta.env?.VITE_MAP3D === '1') return true;
  return (
    !!import.meta.env?.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('map3d')
  );
}

export function buildingModelFile(buildingId: number): string | null {
  if (!map3dEnabled()) return null;
  return BUILDING_MODEL_FILES[buildingId] ?? null;
}

export function hasBuildingModel(buildingId: number): boolean {
  return buildingModelFile(buildingId) !== null;
}
