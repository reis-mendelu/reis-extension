import type { AppSlice } from '../types';
import type { OsmTileAccess } from '../../utils/osmTileAccess';
import { redrawBasemap } from '../../components/CampusMap/mapInstance';

/**
 * Whether the browser lets reIS name itself on OpenStreetMap tile requests
 * (src/utils/osmTileAccess.ts). Written by the watcher main.tsx starts at
 * boot, and by the banner's own Allow; read by the banner on both map trees.
 * Only `missing` shows it, which the apps and the dev webapp — no permissions
 * API — never report.
 */
export interface OsmTileAccessSlice {
  osmTileAccess: OsmTileAccess;
  setOsmTileAccess: (next: OsmTileAccess) => void;
}

export const createOsmTileAccessSlice: AppSlice<OsmTileAccessSlice> = (set, get) => ({
  osmTileAccess: 'checking',
  setOsmTileAccess: (next) => {
    const prev = get().osmTileAccess;
    if (prev === next) return;
    set({ osmTileAccess: next });
    // However it was granted — the banner, about:addons, Chrome's site-access
    // menu — the tiles already on screen went out anonymous. Fetch them again.
    if (prev === 'missing' && next === 'granted') redrawBasemap();
  },
});
