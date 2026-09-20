/**
 * Joining an OSM-sourced corridor to a node that did not come from OSM.
 *
 * `remoteCorridor.corridorWays` solves the neighbouring problem — a HAND-CURATED
 * path whose single meaningful endpoint is declared to be a particular gate —
 * and it is deliberately strict: it rewrites exactly one vertex, refuses a
 * corridor that does not start where it claims, and never bridges a gap.
 *
 * That strictness is wrong for a corridor made of a hundred OSM ways. The
 * failure it produces is worth recording, because it looks like success:
 * rewriting ONE vertex of ONE way moves that way onto the anchor and, in doing
 * so, DETACHES it from the OSM neighbours that still carry the original
 * coordinate. The corridor joins the campus through a single way and splits
 * itself off from the rest of its own network. Measured on the FRRMS corridor:
 * 583 of 1055 nodes reachable, and every route from the gate gone.
 *
 * The cause is the codebase's oldest geometry hazard. The garden's curated gate
 * sits at 16.6148990,49.2159310 and OSM's node for the same gate at
 * 16.6148992,49.2159308 — two centimetres apart, and two different `nodeKey`s.
 *
 * So this rewrites EVERY corridor vertex within `toleranceM` of the anchor,
 * rather than one. That is still a declared join at a named place, not a
 * proximity bridge: the tolerance is centimetres, it applies only at the one
 * coordinate the caller names, and a corridor with nothing near that coordinate
 * is refused rather than stretched.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

import { metres } from './pathGeo.mjs';

/**
 * @param {[number,number][][]} ways     corridor geometry, one coord list per way
 * @param {[number,number]} anchor       the existing graph node to join at
 * @param {number} toleranceM            how far a vertex may be and still BE that node
 * @returns {{coords:[number,number][]}[]}
 */
export function joinAtAnchor(ways, anchor, toleranceM) {
  let joined = 0;
  const out = ways.map((coords) => ({
    coords: coords.map((c) => {
      if (metres(c, anchor) > toleranceM) return c;
      joined++;
      return anchor;
    }),
  }));
  if (joined === 0) {
    const nearest = Math.min(
      ...ways.flatMap((coords) => coords.map((c) => metres(c, anchor)))
    );
    throw new Error(
      `corridor has no vertex within ${toleranceM} m of its anchor (nearest ${nearest.toFixed(1)} m) — ` +
        'it does not reach the place it claims to start at, and joining it would invent a connection'
    );
  }
  return out;
}
