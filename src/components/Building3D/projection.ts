/**
 * The building model's local frame — the SAME maths as reis-data's generator
 * (`scripts/q3d/geometry.mjs`), so a room outline projected here lands on the
 * walls it was built against. x = metres east of the anchor, z = metres SOUTH
 * (three.js is right-handed with y up, which puts south at +z).
 */

/** Metres per degree at a latitude (WGS84 series, centimetre-good at campus scale). */
export function metresPerDegree(latDeg: number): { lat: number; lng: number } {
  const φ = (latDeg * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ),
    lng: 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ),
  };
}

export type Projector = (lngLat: readonly number[]) => [number, number];

/** [lng, lat] → [x, z] around `anchor` ([lng, lat]). */
export function makeProjector(anchor: readonly [number, number]): Projector {
  const m = metresPerDegree(anchor[1]);
  return ([lng = 0, lat = 0]) => [(lng - anchor[0]) * m.lng, -(lat - anchor[1]) * m.lat];
}
