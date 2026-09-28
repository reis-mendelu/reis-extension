import type { BuildingModelStorey } from '../../types/buildingModel';

export type StoreyRole = 'lifted' | 'target' | 'below';

export interface StoreyPlan {
  level: number;
  role: StoreyRole;
  /** Metres to move the storey up. */
  offsetY: number;
  /** Opacity for the storey's walls and roofs (its floor stays opaque). */
  opacity: number;
}

/** How far the lid rises: enough to see into the target floor from a raised camera. */
export const LIFT_M = 9;

// The lid is a ghost: for a basement room it is six storeys deep, and anything
// denser blurs the floor it was lifted to reveal.
const OPACITY: Record<StoreyRole, number> = { lifted: 0.1, target: 0.32, below: 1 };

/**
 * The cutaway for a lesson on `target`: every storey above it rises together
 * like a lid and fades, the target's own walls turn translucent so its rooms
 * show, everything below stays solid. An unknown floor cuts nothing — the whole
 * building is still worth seeing.
 */
export function cutawayPlan(storeys: BuildingModelStorey[], target: number | null): StoreyPlan[] {
  const known = target !== null && storeys.some((s) => s.level === target);
  return storeys.map(({ level }) => {
    const role: StoreyRole = !known
      ? 'below'
      : level > target
        ? 'lifted'
        : level === target
          ? 'target'
          : 'below';
    return { level, role, offsetY: role === 'lifted' ? LIFT_M : 0, opacity: OPACITY[role] };
  });
}

/**
 * The top of the room's storey, in metres above the model's base: with the
 * storeys above cut away it is the top of what the tilted map draws, so the
 * camera frames it and the pin rises from it. An unknown floor draws it all.
 */
export function storeyCeiling(
  storeys: BuildingModelStorey[],
  level: number | null,
  buildingHeight: number
): number {
  const s = storeys.find((x) => x.level === level);
  return s ? s.elevation + s.height : buildingHeight;
}

/** The storey's floor lies below the ground (`groundY`, the same frame): a basement. */
export function isUnderground(
  storeys: BuildingModelStorey[],
  level: number | null,
  groundY: number
): boolean {
  const s = storeys.find((x) => x.level === level);
  return s !== undefined && s.elevation < groundY;
}
