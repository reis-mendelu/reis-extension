import type { Building, Landmark } from '../../types/campusMap';

const ringKey = (ring: readonly (readonly number[])[]) =>
  ring.map((p) => `${p[0]!.toFixed(7)},${p[1]!.toFixed(7)}`).join(';');

/**
 * The building a landmark is drawn as, when both carry the same outline.
 *
 * FRRMS (1587) and Kolej Akademie (1616) are one structure, and since 2026-09
 * that structure is budova Z with a floor plan (reis-data source/curated/Z,
 * whose outline is copied from 1587). Landmarks draw on top of buildings, so
 * drawing either would swallow every tap on Z. They stay in landmarks.json for
 * search and the Places list, and are simply not drawn a second time.
 */
export function buildingSharingOutline(
  l: Landmark,
  buildings: readonly Building[]
): Building | undefined {
  const key = ringKey(l.outline.coordinates[0]!);
  return buildings.find((b) => ringKey(b.outline.coordinates[0]!) === key);
}
