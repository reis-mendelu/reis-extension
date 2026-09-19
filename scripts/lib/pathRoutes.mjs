/**
 * Turns the chopped-up OSM pedestrian ways of a campus into a handful of
 * continuous walking routes.
 *
 * Overpass hands back the footpath network the way OSM stores it: split at
 * every junction, every surface change, every mapper's session boundary. On the
 * MENDELU campus that is ~100 ways with a median length of 33 m and exactly one
 * `name` between them. Drawn as-is it is a mesh of anonymous stubs — a student
 * tapping one gets 30 m of line that answers nothing.
 *
 * `mergeRoutes` re-assembles that mesh into the walks a person actually takes:
 * it follows the STRAIGHTEST continuation through each junction instead of
 * stopping there, which is what makes a route end where the walking ends rather
 * than where a mapper pressed save.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

const R_LAT_M = 110540; // metres per degree of latitude
const lonScale = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Coordinates only join when OSM gave them the SAME node — never "close enough".
 *  7 decimals is ~1 cm: it survives JSON round-tripping without inventing links
 *  between paths that merely pass near each other. */
const key = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`;

const metres = ([alon, alat], [blon, blat]) =>
  Math.hypot((blon - alon) * lonScale(alat), (blat - alat) * R_LAT_M);

/** Compass bearing a→b in degrees, 0 = north. */
function bearing([alon, alat], [blon, blat]) {
  const dx = (blon - alon) * lonScale(alat);
  const dy = (blat - alat) * R_LAT_M;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two bearings, 0..180. */
const turn = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Total ground length of a route, in metres. */
export function routeLengthM(route) {
  let d = 0;
  for (let i = 1; i < route.coords.length; i++) d += metres(route.coords[i - 1], route.coords[i]);
  return d;
}

/**
 * @param {{id:number, coords:[number,number][]}[]} ways
 * @param {{maxTurnDeg?:number}} opts  How sharp a corner still counts as the
 *   same walk. 75° keeps a path round a building corner whole while refusing to
 *   turn a T-junction into a hairpin.
 * @returns {{coords:[number,number][], wayIds:number[]}[]}
 */
export function mergeRoutes(ways, { maxTurnDeg = 75 } = {}) {
  const usable = ways.filter((w) => w.coords.length >= 2);
  const ends = new Map();
  for (const w of usable)
    for (const k of [key(w.coords[0]), key(w.coords.at(-1))]) {
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(w);
    }

  const used = new Set();
  /** The way oriented so it leaves `k`, or null if it does not touch `k`. */
  const leaving = (w, k) => {
    if (key(w.coords[0]) === k) return w.coords;
    if (key(w.coords.at(-1)) === k) return [...w.coords].reverse();
    return null;
  };
  /** Best unused continuation at tip `k` arriving on bearing `inB`. */
  const pick = (k, inB) => {
    let best = null;
    for (const cand of ends.get(k) ?? []) {
      if (used.has(cand.id)) continue;
      const oriented = leaving(cand, k);
      if (!oriented) continue;
      const t = turn(inB, bearing(oriented[0], oriented[1]));
      if (t > maxTurnDeg) continue;
      // Ties broken by id so a re-run of the generator produces byte-identical
      // JSON — a diff in committed map data should mean OSM changed.
      if (!best || t < best.t - 1e-9 || (Math.abs(t - best.t) <= 1e-9 && cand.id < best.way.id))
        best = { t, way: cand, oriented };
    }
    return best;
  };

  // Ways with a free (degree-1) end are walked first so a route starts where the
  // walking starts, not wherever the input order happened to land.
  const freeEnd = (w) =>
    (ends.get(key(w.coords[0]))?.length ?? 0) === 1 ||
    (ends.get(key(w.coords.at(-1)))?.length ?? 0) === 1;
  const order = [...usable.filter(freeEnd), ...usable.filter((w) => !freeEnd(w))];

  const routes = [];
  for (const start of order) {
    if (used.has(start.id)) continue;
    used.add(start.id);
    let coords = [...start.coords];
    const wayIds = [start.id];

    for (;;) {
      const tip = coords.at(-1);
      const next = pick(key(tip), bearing(coords.at(-2), tip));
      if (!next) break;
      used.add(next.way.id);
      wayIds.push(next.way.id);
      coords = coords.concat(next.oriented.slice(1));
    }
    for (;;) {
      const tip = coords[0];
      const next = pick(key(tip), bearing(coords[1], tip));
      if (!next) break;
      used.add(next.way.id);
      wayIds.push(next.way.id);
      coords = [...next.oriented].reverse().slice(0, -1).concat(coords);
    }
    routes.push({ coords, wayIds });
  }
  return routes;
}

/**
 * Names a route after the campus place at each of its two ends.
 *
 * This describes the line that is drawn — "this path runs from the main gate to
 * Q" — and is deliberately NOT routing: reIS is not claiming it is the way to
 * get from one to the other, only saying where this particular path begins and
 * ends. A route whose end sits in the middle of nothing keeps a null there.
 */
export function labelRoute(route, places, radiusM = 35) {
  // Excluded BY NAME, not by identity: a building is passed in as one place per
  // outline vertex (so "distance to the place" is distance to the wall, not to
  // its centroid), and both ends of a route along one wing would otherwise both
  // come back "A".
  const nearest = (pt, exclude) => {
    let best = null;
    for (const p of places) {
      if (exclude !== null && p.name === exclude) continue;
      const d = metres(pt, [p.lon, p.lat]);
      if (d <= radiusM && (!best || d < best.d)) best = { d, p };
    }
    return best?.p ?? null;
  };
  const from = nearest(route.coords[0], null);
  const to = nearest(route.coords.at(-1), from?.name ?? null);
  return { from: from?.name ?? null, to: to?.name ?? null };
}

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
