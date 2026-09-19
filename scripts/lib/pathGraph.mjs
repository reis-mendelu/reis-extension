/**
 * The campus path network as a graph, and the places pinned onto it.
 *
 * OSM stores the MENDELU campus as ~100 ways with a median length of 33 m and
 * exactly one `name` between them. Nothing useful can be said about that until
 * it is a graph, so this module builds one and works out which node each campus
 * place sits on. Deriving walks over it is pathWalks; trimming the raw OSM
 * geometry down to the campus first is osmClip.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

import { metres, nodeKey } from './pathGeo.mjs';

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
