/**
 * What comes OUT of the campus path graph: the walks students take, and the
 * one set of strokes those walks are drawn as.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

import { nodeKey } from './pathGeo.mjs';

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
