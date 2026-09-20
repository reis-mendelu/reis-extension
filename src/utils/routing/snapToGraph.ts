import type { CampusGraph } from '../../types/campusMap';
import { nearestOnSegment } from './geo';

/**
 * The length of an edge in metres — always the third element.
 *
 * Read through here rather than by index at a call site: the tuple is typed
 * loosely because it comes out of a JSON import, and `edge[2] as number`
 * scattered through the router is how the fourth element eventually gets read
 * as a length by mistake.
 */
export function edgeLength(edge: (number | string)[]): number {
  return edge[2] as number;
}

/** Which gate controls this edge, or null when it is always walkable. */
export function edgeGate(edge: (number | string)[]): string | null {
  return edge.length > 3 ? (edge[3] as string) : null;
}

export interface Snap {
  /** The point on the network the walk actually starts from. */
  point: [number, number];
  /** How far the queried position was from the network. */
  distanceM: number;
  a: number;
  b: number;
  /** Metres from `point` to node `a`, along the edge. */
  toA: number;
  /** Metres from `point` to node `b`, along the edge. */
  toB: number;
  gateId: string | null;
}

/**
 * Where on the walking network a given position sits.
 *
 * Nearest EDGE, not nearest node. A student standing halfway along a path is
 * nearest to a point that has no node on it; snapping them to whichever end
 * happened to be closer would add up to half an edge of phantom walking, in
 * whichever direction the graph's vertices happened to fall.
 *
 * `maxM` is how far off the network a position may be and still be routed
 * from. Beyond it the answer is `null`, because "you are not near the campus"
 * is a real answer and a route invented from the main gate for someone in
 * Prague is not.
 */
export function snapToGraph(
  graph: CampusGraph,
  at: [number, number],
  maxM = 250
): Snap | null {
  let best: Snap | null = null;
  for (const edge of graph.edges) {
    const a = edge[0] as number;
    const b = edge[1] as number;
    const near = nearestOnSegment(
      at,
      graph.nodes[a] as [number, number],
      graph.nodes[b] as [number, number]
    );
    if (best && near.distanceM >= best.distanceM) continue;
    const len = edgeLength(edge);
    best = {
      point: near.point,
      distanceM: near.distanceM,
      a,
      b,
      // Split by `t` rather than re-measuring from the snapped point. The
      // committed length is the denomination every other cost in the search
      // uses, and re-measuring here would leave the two halves not adding up
      // to it — a small, permanent inconsistency in every route's total.
      toA: len * near.t,
      toB: len * (1 - near.t),
      gateId: edgeGate(edge),
    };
  }
  return best && best.distanceM <= maxM ? best : null;
}
