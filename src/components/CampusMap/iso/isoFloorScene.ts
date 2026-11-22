import buildingsJson from '../../../data/map/buildings.json';
import plates from '../../../data/map/isoPlates.json';
import type { BuildingsMeta, RoomsCollection } from '../../../types/campusMap';
import { floorHeights, isoRing, svgPath, volumeAbove } from '../../../data/map/isoFloors';
import { isStairs, stairTreads } from '../../../data/map/isoStairs';
import { polygonCentroid } from '../mapHelpers';

const META = buildingsJson as BuildingsMeta;
const FOOTPRINTS = plates as unknown as Record<string, [number, number][][]>;

/**
 * Everything drawn for one floor, in picture pixels: the building above it (frosted), the plate,
 * dashed legs down to the ground, and each room of the floor with where its name goes. Null when
 * there is no such building or floor. Rooms may still be loading: the building is drawn without them.
 */
export function buildFloorScene(
  buildingId: number | null,
  floorId: number | null,
  rooms: RoomsCollection | undefined
) {
  const b = META.buildings.find((x) => x.id === buildingId);
  const floor = b?.floors.find((f) => f.id === floorId);
  if (!b || !floor) return null;
  const { groundM, baseM, floorM, roofM, lowest } = floorHeights(b);
  const z = baseM + (floor.level - lowest) * floorM;
  const ring = b.outline.coordinates[0]!;
  const plate = isoRing(ring, z);
  // What is drawn is the building's real footprint (no courtyard, no lower wing), where the picture is cut
  // from one; the outline still pairs the plate with the ground for the legs.
  const deck = (FOOTPRINTS[b.id] ?? [ring]).map((r) => isoRing(r, z));
  const feats = (rooms?.features ?? []).filter((f) => f.properties.floorId === floorId);
  const placed = feats.map((f) => {
    const r = isoRing(f.geometry.coordinates[0]!, z);
    const [cx, cy] = polygonCentroid(r);
    const xs = r.map((p) => p[0]);
    const ys = r.map((p) => p[1]);
    return {
      f,
      ring: r,
      // Stairs are drawn as steps (see isoStairs.ts); every other room has none.
      treads: isStairs(f.properties.type) ? stairTreads(f.geometry.coordinates[0]!, z) : '',
      at: [cx, cy] as [number, number],
      area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
    };
  });
  return {
    level: floor.level,
    z,
    plate,
    deck,
    // One path per face: joined into a single path, faces of opposite winding cancel where they overlap.
    ghost: volumeAbove(ring, Math.max(z, groundM), roofM).map((face) => svgPath([face])),
    legs:
      z > groundM
        ? svgPath(
            isoRing(ring, groundM).map((p, i) => [p, plate[i]!] as [number, number][])
          ).replace(/Z/g, '')
        : '',
    placed,
  };
}
