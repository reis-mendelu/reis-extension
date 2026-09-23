/**
 * The flat-earth arithmetic the runtime router uses.
 *
 * A deliberate duplicate of `scripts/lib/pathGeo.mjs`, which is build-time and
 * does not ship. The constants are repeated rather than shared because the two
 * live on opposite sides of the bundle boundary; the tests pin both to the same
 * values, so the router and the pipeline cannot quietly drift apart on what a
 * metre is. They must not: a route's length is summed from edge lengths the
 * pipeline computed, and a snap offset this file computes is added to them.
 *
 * A campus is 400 m across and the longest walk here is under 2 km, so an
 * equirectangular approximation is exact enough; a great-circle formula would
 * be noise inside a shortest-path loop.
 */

const R_LAT_M = 110540;
const lonScale = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

export function metres(a: [number, number], b: [number, number]): number {
  return Math.hypot((b[0] - a[0]) * lonScale(a[1]), (b[1] - a[1]) * R_LAT_M);
}

export interface NearestPoint {
  point: [number, number];
  /** Where along a→b the foot lands: 0 at a, 1 at b. */
  t: number;
  distanceM: number;
}

/**
 * The point on segment a→b nearest to p, clamped to the segment.
 *
 * Projected in METRES rather than in degrees. A degree of longitude is 0.65 of
 * a degree of latitude at this latitude, so projecting in raw degrees puts the
 * foot in the wrong place on any segment that is not axis-aligned — which is
 * most of a real footpath network.
 */
export function nearestOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): NearestPoint {
  const s = lonScale(a[1]);
  const bx = (b[0] - a[0]) * s;
  const by = (b[1] - a[1]) * R_LAT_M;
  const px = (p[0] - a[0]) * s;
  const py = (p[1] - a[1]) * R_LAT_M;

  const len2 = bx * bx + by * by;
  // A zero-length segment is a repeated vertex, not a direction. Clamp to `a`
  // rather than dividing by zero and feeding NaN into a shortest-path search,
  // where it would poison every comparison it touches.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const point: [number, number] =
    t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, t, distanceM: metres(p, point) };
}
