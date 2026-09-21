import campusPaths from '../../data/map/campusPaths.json';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from './snapToGraph';

const GRAPH = (campusPaths as unknown as { graph: CampusGraph }).graph;

/**
 * Whether a walk could be built from here at all — the question that decides
 * whether the offer is worth making.
 *
 * Asked for as "only within about 1.5 km of campus, and it must reach FRRMS".
 * This answers that with the router instead of a circle, and the two agree
 * almost everywhere: the main gate (96 m), FRRMS (849 m) and the JAK
 * dormitories (1223 m) all pass both, and Špilberk, the main station and
 * Prague fail both.
 *
 * They disagree in the place that matters. Lužánky park is 715 m from the
 * campus centre — comfortably inside any 1.5 km circle — and has no mapped
 * path within `snapToGraph`'s 250 m tolerance, so no walk can start there. A
 * circle would offer the pill and the press would draw nothing, which is the
 * dead press this rule exists to prevent.
 *
 * `null` is not a no. No fix means the student was never asked for their
 * location, and hiding the offer on a guess would take the feature away from
 * someone standing on the campus.
 */
export function canRouteFrom(at: [number, number] | null): boolean {
  if (!at) return true;
  return snapToGraph(GRAPH, at) !== null;
}
