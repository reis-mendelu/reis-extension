/**
 * Joining a hand-curated off-campus corridor to the OSM campus network.
 *
 * The campus graph is built from raw Overpass geometry; the arboretum corridor
 * in remotePlaces.json is hand-curated and committed at 6 decimals. They meet
 * at one real place — the gate out of the campus into the garden — but the two
 * coordinates for it differ in the 7th decimal, which is exactly where nodeKey
 * stops calling two points the same node. Left alone the corridor hangs off the
 * campus as its own island and no walk crosses it.
 *
 * So the join is declared rather than inferred: the caller names the ONE anchor
 * the corridor starts at, and the corridor's vertex there is rewritten to that
 * node's exact coordinate. That is a statement about the world ("this path
 * begins at that gate"), not a proximity bridge — pathGeo's rule that two ways
 * join only on a shared node is untouched, and a corridor that does not in fact
 * start at the anchor is refused rather than stretched to reach it.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

import { metres } from './pathGeo.mjs';

/**
 * The corridor as graph ways, pinned to the anchor node.
 *
 * @param {[number,number][][]} paths   the committed path strokes
 * @param {[number,number]} anchor      the graph node the corridor starts at
 * @param {number} maxM                 how far the corridor may start from it
 * @returns {{coords:[number,number][]}[]}
 */
export function corridorWays(paths, anchor, maxM) {
  // ENDPOINTS only. A stroke's own middle passing within tolerance of the gate
  // is not "the corridor starts here" — rewriting an interior vertex would
  // splice the campus into the side of a path and attach both of its halves,
  // which is the invented connection this guard exists to refuse. If the
  // curated geometry ever loses the endpoint it is meant to start at, the run
  // should fail rather than quietly latch onto the nearest passing stroke.
  let best = { d: Infinity, path: -1, vertex: -1 };
  paths.forEach((coords, path) => {
    for (const vertex of [0, coords.length - 1]) {
      const d = metres(coords[vertex], anchor);
      if (d < best.d) best = { d, path, vertex };
    }
  });
  if (best.d > maxM)
    throw new Error(
      `corridor starts ${best.d.toFixed(1)} m from its anchor (max ${maxM} m) — ` +
        'it does not begin where it claims to, and joining it would invent a connection'
    );
  return paths.map((coords, path) => ({
    coords: coords.map((c, vertex) => (path === best.path && vertex === best.vertex ? anchor : c)),
  }));
}
