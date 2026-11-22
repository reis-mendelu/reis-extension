import { IMG } from './isoView';
import type { IsoSeason } from './isoMap';
import { ISO_BUILDINGS } from './isoBuildings';

/**
 * Re-rendered patches of the picture with a building cut off at a floor, so the floor view can
 * show the building really ending at the plate instead of frosting the real one over it.
 * izomapa renders them (build/cuts_all.py, outside this repo) for one season: a building without
 * a patch, or any other season, falls back to the frosted look. One patch per floor at or above
 * the ground, and one shared by every floor below it (the building removed).
 */
export function cutawayFor(buildingId: number, level: number, season: IsoSeason) {
  const b = ISO_BUILDINGS[buildingId];
  if (!b || season !== 'summer' || level > b.top) return null;
  return {
    file: `cutaway/b${buildingId}-${level < b.lowest ? 'g' : level}.webp`,
    x: b.cut.x / IMG.w,
    y: b.cut.y / IMG.w,
    width: b.cut.w / IMG.w,
  };
}
