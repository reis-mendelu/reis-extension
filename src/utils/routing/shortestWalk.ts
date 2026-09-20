import type { CampusGraph } from '../../types/campusMap';
import { edgeGate, edgeLength, type Snap } from './snapToGraph';

export interface Walk {
  /** [lon, lat], from the snapped start to the arrival node. */
  coords: number[][];
  lengthM: number;
}

/**
 * The shortest walk from a snapped position to any one of several target nodes.
 *
 * Multi-target because a building is a set of door nodes, not a point. Asking
 * for "the" node would pick a door on the wrong side of the building as often
 * as not, and send a student the long way round it.
 *
 * `isOpen` is what stops the router recommending a walk nobody can take. The
 * botanical garden shuts at 20:00 and all weekend, and greying the card
 * afterwards is not enough: left to itself the search returns the garden route
 * at 21:00 on a Saturday, and — worse, because it is invisible — threads the
 * garden through the middle of a journey that had nothing to do with it.
 * Availability is a property of the graph, so it is applied here, where the
 * path is chosen. The card then only has to explain the answer.
 */
export function shortestWalk(
  graph: CampusGraph,
  from: Snap,
  targets: number[],
  isOpen: (gateId: string) => boolean
): Walk | null {
  if (targets.length === 0) return null;
  // Standing on a shut stretch is not a place you may walk from.
  if (from.gateId && !isOpen(from.gateId)) return null;

  const adj = new Map<number, { to: number; len: number }[]>();
  for (const edge of graph.edges) {
    const gate = edgeGate(edge);
    if (gate !== null && !isOpen(gate)) continue;
    const a = edge[0] as number;
    const b = edge[1] as number;
    const len = edgeLength(edge);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, len });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, len });
  }

  const goal = new Set(targets);
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  // Two seeds: from the snapped point the walk may leave along the edge it
  // landed on in either direction, and which one is shorter depends on where
  // it is going.
  dist.set(from.a, from.toA);
  dist.set(from.b, from.toB);

  // Linear scan rather than a binary heap. The campus graph is ~650 edges and
  // this runs once per tap, not per frame; a heap would be more code for time
  // nobody can perceive.
  const queue: number[] = [from.a, from.b];
  const done = new Set<number>();
  let arrived: number | null = null;

  while (queue.length) {
    let bestI = 0;
    for (let i = 1; i < queue.length; i++) {
      if ((dist.get(queue[i]) ?? Infinity) < (dist.get(queue[bestI]) ?? Infinity)) bestI = i;
    }
    const u = queue.splice(bestI, 1)[0];
    if (done.has(u)) continue;
    done.add(u);
    if (goal.has(u)) {
      arrived = u;
      break;
    }
    for (const { to, len } of adj.get(u) ?? []) {
      if (done.has(to)) continue;
      const nd = (dist.get(u) ?? Infinity) + len;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
        queue.push(to);
      }
    }
  }

  if (arrived === null) return null;

  const back: number[] = [arrived];
  while (prev.has(back[back.length - 1])) back.push(prev.get(back[back.length - 1])!);
  const nodes = back.reverse();
  return {
    coords: [from.point, ...nodes.map((n) => graph.nodes[n])],
    lengthM: dist.get(arrived)!,
  };
}
