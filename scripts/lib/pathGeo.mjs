/**
 * The flat-earth arithmetic the campus path pipeline runs on.
 *
 * A campus is 400 m across, so an equirectangular approximation is exact
 * enough and a great-circle formula would be noise. Shared by pathGraph,
 * pathWalks and osmClip so the three agree on what a metre is.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

export const R_LAT_M = 110540;
export const lonScale = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Two ways join only when OSM gave them the SAME node — never "close enough".
 *  7 decimals is ~1 cm. Bridging a visible-but-unmapped gap would invent a
 *  connection that may not exist on the ground. */
export const nodeKey = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`;

export const metres = ([alon, alat], [blon, blat]) =>
  Math.hypot((blon - alon) * lonScale(alat), (blat - alat) * R_LAT_M);
