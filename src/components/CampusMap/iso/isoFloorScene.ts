import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta, RoomsCollection } from '../../../types/campusMap';
import { floorHeights, isoRing, svgPath, volumeAbove } from '../../../data/map/isoFloors';
import { polygonCentroid } from '../mapHelpers';

const META = buildingsJson as BuildingsMeta;

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
  const { floorM, roofM } = floorHeights(b);
  const z = floor.level * floorM;
  const ring = b.outline.coordinates[0]!;
  const plate = isoRing(ring, z);
  const feats = (rooms?.features ?? []).filter((f) => f.properties.floorId === floorId);
  const placed = feats.map((f) => {
    const r = isoRing(f.geometry.coordinates[0]!, z);
    const [cx, cy] = polygonCentroid(r);
    const xs = r.map((p) => p[0]);
    const ys = r.map((p) => p[1]);
    return {
      f,
      ring: r,
      at: [cx, cy] as [number, number],
      area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
    };
  });
  return {
    z,
    plate,
    ghost: svgPath(volumeAbove(ring, Math.max(z, 0), roofM)),
    legs:
      z > 0
        ? svgPath(isoRing(ring, 0).map((p, i) => [p, plate[i]!] as [number, number][])).replace(
            /Z/g,
            ''
          )
        : '',
    placed,
  };
}
