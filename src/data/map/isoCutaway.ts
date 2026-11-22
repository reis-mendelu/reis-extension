import { IMG } from './isoView';
import type { IsoSeason } from './isoMap';

/**
 * Re-rendered patches of the picture with a building cut off at a floor, so the floor view can
 * show the building really ending at the plate instead of frosting the real one over it.
 * izomapa renders them (build/cuts.sh, outside this repo) for one season: a building without
 * a patch, or any other season, falls back to the frosted look.
 *
 * `rect` is where the patch sits in the picture's pixels (the whole area the cut changes,
 * shadows included, so its edge is identical to the picture around it).
 */
const CUTAWAYS: Readonly<
  Record<number, { rect: { x: number; y: number; w: number; h: number }; top: number }>
> = {
  // Q: levels 0..5 are cut at their floor; below the ground there is nothing to cut but the building.
  0: { rect: { x: 5512, y: 5207, w: 584, h: 421 }, top: 5 },
};

export function cutawayFor(buildingId: number, level: number, season: IsoSeason) {
  const known = CUTAWAYS[buildingId];
  if (!known || season !== 'summer' || level > known.top) return null;
  const { rect } = known;
  return {
    file: `cutaway/b${buildingId}-${level < 0 ? 'g' : level}.webp`,
    x: rect.x / IMG.w,
    y: rect.y / IMG.w,
    width: rect.w / IMG.w,
  };
}
