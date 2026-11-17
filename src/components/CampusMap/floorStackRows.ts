import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta } from '../../types/campusMap';
import { hasBuildingModel } from '../../data/map/buildingModels';

const META = buildingsJson as BuildingsMeta;

/**
 * How many buttons `FloorStack` stacks for a building: one per floor, plus the
 * 3D/2D switch (`TiltButton`) when the building has a model. Null when no
 * building is open — there is no column then. Keep in step with FloorStack.
 */
export function floorStackRows(buildingId: number | null): number | null {
  if (buildingId === null) return null;
  const b = META.buildings.find((x) => x.id === buildingId);
  if (!b) return null;
  return b.floors.length + (hasBuildingModel(buildingId) ? 1 : 0);
}
