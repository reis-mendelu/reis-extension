/**
 * Turns the OSM pedestrian ways of a campus into ROUTES BETWEEN PLACES.
 *
 * The first attempt at this chained ways together by following the straightest
 * continuation through each junction. It drew the network, but the pieces it
 * produced were arbitrary: a route ended where the chaining rule ran out, which
 * is not anywhere a person stops walking. Tapping one gave you a fragment
 * between two points that are not places.
 *
 * So the ways are treated as what they are — a graph — and a route is the walk
 * between two campus places that passes through no third one. That is the
 * "neighbouring places" set: every route starts and ends somewhere a student
 * would name, and the whole network is reachable by walking from one to the
 * next.
 *
 * Honest about what it is: a route IS the shortest walk along the paths OSM has
 * mapped. Where OSM is incomplete the shortest mapped walk and the shortest real
 * walk differ, and this cannot tell the difference.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

const R_LAT_M = 110540;
const lonScale = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Two ways join only when OSM gave them the SAME node — never "close enough".
 *  7 decimals is ~1 cm. Bridging a visible-but-unmapped gap would invent a
 *  connection that may not exist on the ground. */
export const nodeKey = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`;

const metres = ([alon, alat], [blon, blat]) =>
  Math.hypot((blon - alon) * lonScale(alat), (blat - alat) * R_LAT_M);

/**
 * @param {{coords:[number,number][]}[]} ways
 * @returns {{nodes: Map<string,[number,number]>, adj: Map<string, Map<string, number>>}}
 */
export function buildGraph(ways) {
  const nodes = new Map();
  const adj = new Map();
  const add = (c) => {
    const k = nodeKey(c);
    if (!nodes.has(k)) {
      nodes.set(k, c);
      adj.set(k, new Map());
    }
    return k;
  };
  for (const way of ways) {
    for (let i = 0; i < way.coords.length; i++) {
      const k = add(way.coords[i]);
      if (i === 0) continue;
      const p = nodeKey(way.coords[i - 1]);
      if (p === k) continue; // a repeated vertex is not an edge
      const d = metres(way.coords[i - 1], way.coords[i]);
      // Keep the SHORTEST edge when two ways overlap between the same pair.
      adj.get(p).set(k, Math.min(adj.get(p).get(k) ?? Infinity, d));
      adj.get(k).set(p, Math.min(adj.get(k).get(p) ?? Infinity, d));
    }
  }
  return { nodes, adj };
}

/**
 * Pins each named place to the ONE graph node nearest to it.
 *
 * Places arrive as points, and a polygon place (a building) arrives as one entry
 * per outline vertex so that "near it" means near its wall. Collapsing those to
 * a single node here is what stops every wall corner from splitting a route.
 *
 * @returns {Map<string,string>} node key → place name
 */
export function snapAnchors(graph, places, radiusM = 35) {
  const best = new Map(); // name → {d, k}
  for (const p of places) {
    for (const [k, c] of graph.nodes) {
      const d = metres([p.lon, p.lat], c);
      if (d > radiusM) continue;
      const cur = best.get(p.name);
      // Ties broken by node key so a re-run produces byte-identical JSON.
      if (!cur || d < cur.d - 1e-9 || (Math.abs(d - cur.d) <= 1e-9 && k < cur.k))
        best.set(p.name, { d, k });
    }
  }
  const anchors = new Map();
  // Sorted so that two places landing on the same node resolve the same way
  // every run; the shorter of the two routes then loses to the length floor.
  for (const name of [...best.keys()].sort()) {
    const { k } = best.get(name);
    if (!anchors.has(k)) anchors.set(k, name);
  }
  return anchors;
}

/**
 * Every walk between two places that passes through no third place.
 *
 * Dijkstra out from each anchor, with the other anchors ABSORBING: when one is
 * reached it records a route and is not expanded through. That is what makes
 * "A ↔ X" and "X ↔ B" two routes rather than also emitting "A ↔ B" over the
 * top of them, which is how you get N² overlapping lines on a map.
 *
 * @returns {{from:string,to:string,lengthM:number,coords:[number,number][]}[]}
 */
export function connectingRoutes(graph, anchorsByNode) {
  const found = new Map(); // "A|B" (sorted) → route
  for (const start of [...anchorsByNode.keys()].sort()) {
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const done = new Set();
    for (;;) {
      let u = null;
      // The campus graph is a few hundred nodes, so a linear scan for the
      // nearest unvisited node is cheaper than maintaining a heap.
      for (const [k, d] of dist) if (!done.has(k) && (u === null || d < dist.get(u) - 1e-9)) u = k;
      if (u === null) break;
      done.add(u);
      if (u !== start && anchorsByNode.has(u)) {
        const from = anchorsByNode.get(start);
        const to = anchorsByNode.get(u);
        const coords = [];
        for (let k = u; k !== undefined; k = prev.get(k)) coords.unshift(graph.nodes.get(k));
        const route = { from, to, lengthM: Math.round(dist.get(u)), coords };
        const key = [from, to].sort().join('|');
        const cur = found.get(key);
        if (!cur || route.lengthM < cur.lengthM) found.set(key, route);
        continue; // absorbed: a route stops at a place, it does not run past it
      }
      for (const [v, w] of graph.adj.get(u)) {
        if (done.has(v)) continue;
        const nd = dist.get(u) + w;
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          prev.set(v, u);
        }
      }
    }
  }
  return [...found.values()];
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
