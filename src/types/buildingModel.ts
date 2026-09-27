/**
 * A building's 3D model as reis-data publishes it: `map/3d/<name>.glb` plus the
 * `<name>.json` described here (reis-data scripts/buildQModel.mjs writes both).
 *
 * The local frame is shared with that generator: x = metres east of `anchor`,
 * y = metres up from `baseElevation`, z = metres SOUTH of `anchor`.
 */
export interface BuildingModelStorey {
  level: number;
  /** Floor of this storey, metres above the base. */
  elevation: number;
  height: number;
}

export interface BuildingModelMeta {
  buildingId: number;
  name: string;
  /** [lng, lat] of the local frame's origin. */
  anchor: [number, number];
  baseElevation: number;
  /** Ascending by level; the glb has one node per entry, `storey:<level>`. */
  storeys: BuildingModelStorey[];
  /** Ground plane y = a + b·x + c·z, fitted to the terrain around the building. */
  ground: { a: number; b: number; c: number };
  /** Horizontal radius of the model around the anchor, for framing. */
  radius: number;
  height: number;
  defaultAzimuthDeg: number;
  attribution: string;
}

export interface BuildingModel {
  glb: ArrayBuffer;
  meta: BuildingModelMeta;
  /** When this copy was downloaded — the 30-day cache clock. */
  fetchedAt: number;
}
