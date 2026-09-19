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
export function snapAnchors(graph, places, radiusM = 35, { minSeparationM = 0 } = {}) {
  // Every node each place could sit on, nearest first.
  const reach = new Map(); // name → [{d, k}]
  const rank = new Map(); // name → how much a person navigates by it, 0 = most
  for (const p of places) {
    const list = reach.get(p.name) ?? [];
    for (const [k, c] of graph.nodes) {
      const d = metres([p.lon, p.lat], c);
      if (d <= radiusM) list.push({ d, k });
    }
    reach.set(p.name, list);
    rank.set(p.name, Math.min(rank.get(p.name) ?? Infinity, p.rank ?? 0));
  }
  for (const [name, list] of reach) {
    list.sort((a, b) => a.d - b.d || (a.k < b.k ? -1 : 1));
    // one entry per node: a building arrives as many vertices, all measuring to
    // the same nodes
    const seen = new Set();
    reach.set(
      name,
      list.filter((x) => !seen.has(x.k) && seen.add(x.k))
    );
  }

  // Two places wanting the same node is not hypothetical: building E and the
  // Akademická vinotéka are a few metres apart and both snap to one node. The
  // first version kept whichever name sorted first and dropped the other
  // silently — so a RENAME decided which place existed on the map, and E only
  // ever appeared because "Vinotéka" sorts after it.
  //
  // Instead the closest claim wins the contested node and the loser falls back
  // to its next nearest. A place is dropped only when every node in reach is
  // taken, which is the one case where there is genuinely nowhere to put it.
  // …and `minSeparationM` stops the fallback from producing a near-duplicate.
  // Building E and the vinotéka are the same doorway; two anchors seven metres
  // apart make a seven-metre route, the length floor drops it, and the loser is
  // left on the map with no routes at all. Better to keep one anchor there —
  // and `rank` decides which, so a lettered building beats the café inside it
  // rather than the contest being settled by whichever is a metre nearer.
  const anchors = new Map();
  const settled = new Set();
  const free = (spot) =>
    !anchors.has(spot.k) &&
    [...anchors.keys()].every(
      (k) => metres(graph.nodes.get(k), graph.nodes.get(spot.k)) >= minSeparationM
    );
  const pending = [...reach.keys()].sort();
  for (;;) {
    let pick = null;
    for (const name of pending) {
      if (settled.has(name)) continue;
      const spot = reach.get(name).find(free);
      if (!spot) {
        settled.add(name); // nowhere left in reach
        continue;
      }
      const better =
        !pick ||
        rank.get(name) < rank.get(pick.name) ||
        (rank.get(name) === rank.get(pick.name) && spot.d < pick.spot.d - 1e-9);
      if (better) pick = { name, spot };
    }
    if (!pick) break;
    anchors.set(pick.spot.k, pick.name);
    settled.add(pick.name);
  }
  return anchors;
}

/** Names that wanted a node but found every one in reach already taken. */
export function unplacedPlaces(graph, places, radiusM = 35, opts = {}) {
  const placed = new Set(snapAnchors(graph, places, radiusM, opts).values());
  const wanted = new Set(places.map((p) => p.name));
  return [...wanted].filter((n) => !placed.has(n)).sort();
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

/**
 * The whole path network as ONE set of strokes, each stretch drawn exactly once.
 *
 * The routes deliberately overlap — that is what makes them connected, and what
 * lets "Budova O ↔ Brána Lesnická" be a single traceable line. But drawing 46
 * overlapping polylines paints every shared stretch several times, and since
 * each is a white casing under a grey line, one route's casing scribbles over
 * the next route's line. 46 routes summed to 8.9 km over a 7 km network; the
 * difference was all double ink.
 *
 * So the base layer is drawn from this instead: the union of every edge the
 * routes use, each edge once, assembled into the longest continuous strokes it
 * can make. That is the deterministic map of where the paths are — one clean
 * network — and the routes stay on top of it as the thing you tap.
 *
 * @param {{coords:[number,number][]}[]} routes
 * @returns {[number,number][][]}
 */
export function networkStrokes(routes) {
  const nodes = new Map();
  const adj = new Map();
  const edgeId = (a, b) => [a, b].sort().join('|');
  const seen = new Set();
  for (const r of routes)
    for (let i = 1; i < r.coords.length; i++) {
      const a = nodeKey(r.coords[i - 1]);
      const b = nodeKey(r.coords[i]);
      if (a === b) continue;
      nodes.set(a, r.coords[i - 1]);
      nodes.set(b, r.coords[i]);
      // A stretch walked the other way round is the same stretch.
      if (seen.has(edgeId(a, b))) continue;
      seen.add(edgeId(a, b));
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
  for (const list of adj.values()) list.sort();

  const walked = new Set();
  const strokes = [];
  // Ends and junctions first, so a stroke runs the length of a path instead of
  // starting in the middle of one; sorted throughout so a re-run of the
  // generator produces byte-identical JSON.
  const starts = [...adj.keys()].sort();
  const passes = [starts.filter((k) => adj.get(k).length !== 2), starts];
  for (const pass of passes)
    for (const start of pass) {
      for (;;) {
        const first = adj.get(start).find((n) => !walked.has(edgeId(start, n)));
        if (first === undefined) break;
        const stroke = [nodes.get(start)];
        let cur = start;
        let next = first;
        for (;;) {
          walked.add(edgeId(cur, next));
          stroke.push(nodes.get(next));
          const onward = adj.get(next).find((n) => !walked.has(edgeId(next, n)));
          if (onward === undefined) break;
          cur = next;
          next = onward;
        }
        strokes.push(stroke);
      }
    }
  return strokes;
}

/**
 * The walk from each entrance to each building.
 *
 * This replaced a "neighbouring places" set, where a route stopped at the first
 * named thing it passed. That answered "how long is this bit of path", which is
 * not a question anyone asks. The question is "I have come in at this gate, how
 * long to my building" — so a walk runs the whole way and passes straight
 * through whatever is in between.
 *
 * Plain Dijkstra, nothing absorbing: origins fan out to every target they can
 * reach. A target the network cannot reach from an origin simply gets no walk
 * rather than an invented one.
 *
 * @param {Map<string,string>} origins  node key → entrance name
 * @param {Map<string,string>} targets  node key → building name
 * @returns {{from:string,to:string,lengthM:number,coords:[number,number][]}[]}
 */
export function walksFrom(graph, origins, targets) {
  const walks = [];
  for (const start of [...origins.keys()].sort()) {
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const done = new Set();
    for (;;) {
      let u = null;
      for (const [k, d] of dist) if (!done.has(k) && (u === null || d < dist.get(u) - 1e-9)) u = k;
      if (u === null) break;
      done.add(u);
      for (const [v, w] of graph.adj.get(u)) {
        if (done.has(v)) continue;
        const nd = dist.get(u) + w;
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          prev.set(v, u);
        }
      }
    }
    for (const end of [...targets.keys()].sort()) {
      if (end === start || !dist.has(end)) continue;
      const from = origins.get(start);
      const to = targets.get(end);
      if (from === to) continue;
      const coords = [];
      for (let k = end; k !== undefined; k = prev.get(k)) coords.unshift(graph.nodes.get(k));
      walks.push({ from, to, lengthM: Math.round(dist.get(end)), coords });
    }
  }
  return walks;
}
