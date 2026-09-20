/**
 * The campus graph, flattened into something the app can ship.
 *
 * `buildGraph` produces Maps keyed by a 7-decimal coordinate string. That is
 * the right shape for the build and the wrong shape for a JSON file every
 * phone parses at startup, so here it becomes two arrays: deduplicated
 * coordinates, and edges naming their endpoints by index.
 *
 * Index pairs rather than repeated coordinates, because the coordinate list is
 * the bulk of the file and an edge naming its endpoints by value would double
 * it. `lengthM` is precomputed so the runtime never does trigonometry per edge
 * inside a shortest-path loop.
 *
 * Why this exists at all: `network` — the strokes the map draws — is
 * deduplicated RENDERING geometry, merged for one clean set of lines. Adjacency
 * cannot be recovered from it without matching coordinates by proximity, which
 * is the 7th-decimal failure `remoteCorridor.mjs` refuses. So the graph is
 * emitted explicitly rather than derived from something never meant to carry it.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

const round = (v) => Number(v.toFixed(6)); // ~0.1 m; matches the rest of the file

/**
 * @param {{nodes: Map<string,[number,number]>, adj: Map<string, Map<string, number>>}} graph
 * @param {Map<string,string>} buildingNodes  node key → building name
 * @param {(a: string, b: string) => string | null} gateOf  which gate, if any, controls this edge
 * @returns {{nodes: number[][], edges: (number|string)[][], buildings: Record<string, number[]>}}
 */
export function exportGraph(graph, buildingNodes, gateOf) {
  // Deduplicated by the coordinate AS EMITTED, not by the graph's own 7-decimal
  // key. Two nodes whose raw positions differ in the 7th decimal round to the
  // same 6, and emitting both produces a pair of distinct indices at one point
  // joined by a zero-length edge — a phantom the runtime cannot tell from a
  // real one. It happens for real at the seam where a corridor's clip box meets
  // the campus geometry.
  //
  // At the precision this file ships, two points that round together ARE one
  // point, so they become one node. The 7-decimal key stays the authority for
  // whether two WAYS join; this only decides what the shipped array contains.
  const index = new Map();
  const byCoord = new Map();
  const nodes = [];
  for (const [key, coord] of graph.nodes) {
    const emitted = [round(coord[0]), round(coord[1])];
    const coordKey = `${emitted[0]},${emitted[1]}`;
    let at = byCoord.get(coordKey);
    if (at === undefined) {
      at = nodes.length;
      byCoord.set(coordKey, at);
      nodes.push(emitted);
    }
    index.set(key, at);
  }

  // Keyed by the EMITTED pair, and the winner is chosen rather than whichever
  // arrived first. Two distinct 7-decimal edges can collapse onto one 6-decimal
  // pair, and when one of them is gated and the other is not, keeping the first
  // seen would let a closed garden delete a connection that is open all week.
  // Ungated beats gated; within the same access class, shorter wins.
  const chosen = new Map();
  for (const [from, neighbours] of graph.adj) {
    for (const [to, lengthM] of neighbours) {
      const a = index.get(from);
      const b = index.get(to);
      // Undirected: emit the pair once. Keyed on the sorted index pair so the
      // direction the adjacency happened to be walked in cannot change the
      // committed output.
      // The node merge above can bring an edge's two ends onto one node. That
      // is a way doubling back on a point, not a route, and Dijkstra has no use
      // for it.
      if (a === b) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const pair = `${lo}-${hi}`;
      const gate = gateOf(from, to);
      const prev = chosen.get(pair);
      if (prev) {
        const prevOpen = prev.gate === null;
        const thisOpen = gate === null;
        if (prevOpen && !thisOpen) continue; // keep the walkable one
        if (prevOpen === thisOpen && prev.lengthM <= lengthM) continue; // keep the shorter
      }
      chosen.set(pair, { lo, hi, lengthM, gate });
    }
  }

  const edges = [];
  for (const { lo, hi, lengthM, gate } of chosen.values()) {
    const edge = [lo, hi, Number(lengthM.toFixed(1))];
    edges.push(gate ? [...edge, gate] : edge);
  }
  edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]); // deterministic JSON

  const buildings = {};
  for (const [key, name] of buildingNodes) {
    (buildings[name] ??= new Set()).add(index.get(key));
  }
  for (const name of Object.keys(buildings)) {
    buildings[name] = [...buildings[name]].sort((a, b) => a - b);
  }

  return { nodes, edges, buildings };
}
