/**
 * Trimming raw Overpass geometry down to the area actually asked for.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

/**
 * Cuts a way down to the parts inside a lat/lon rectangle.
 *
 * Overpass's `out geom` returns each way's FULL geometry even when the query
 * bbox only clipped which ways come back — so one pavement that grazes the
 * campus arrives carrying two kilometres of Zemědělská with it. Without this
 * the merge produces routes that leave Brno-Černá Pole entirely.
 *
 * A segment that crosses the edge keeps the crossing point, so a clipped path
 * ends ON the boundary instead of at the last vertex before it.
 *
 * @returns {[number,number][][]} zero or more runs, each ≥2 points
 */
export function clipToRegion(coords, region) {
  const inside = ([lon, lat]) =>
    lat >= region.s && lat <= region.n && lon >= region.w && lon <= region.e;
  /** Where segment a→b crosses the rectangle edge (Liang–Barsky on the parameter). */
  const cross = (a, b) => {
    let t0 = 0;
    let t1 = 1;
    const p = [a[0] - b[0], b[0] - a[0], a[1] - b[1], b[1] - a[1]];
    const q = [a[0] - region.w, region.e - a[0], a[1] - region.s, region.n - a[1]];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
        continue;
      }
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (t0 > t1) return null;
    const at = (t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    return [at(t0), at(t1)];
  };

  const runs = [];
  let run = [];
  for (let i = 0; i < coords.length; i++) {
    const cur = coords[i];
    if (inside(cur)) {
      if (!run.length && i > 0) {
        // entering: start the run on the boundary, not at the outside vertex
        const seg = cross(coords[i - 1], cur);
        if (seg) run.push(seg[0]);
      }
      run.push(cur);
      continue;
    }
    if (run.length) {
      const seg = cross(run.at(-1), cur);
      if (seg) run.push(seg[1]);
      if (run.length >= 2) runs.push(run);
      run = [];
    } else if (i > 0 && !inside(coords[i - 1])) {
      // both ends outside — the segment can still cut a corner of the rectangle
      const seg = cross(coords[i - 1], cur);
      if (seg && (seg[0][0] !== seg[1][0] || seg[0][1] !== seg[1][1])) runs.push(seg);
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}
