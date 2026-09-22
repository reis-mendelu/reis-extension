import campusPaths from '../../data/map/campusPaths.json';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from './snapToGraph';
import { shortestWalk } from './shortestWalk';

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
 * Snapping alone is not the question, and driving thirteen real places is what
 * showed it: Erbenova, on the west side, lands 9 m from a mapped stretch — and
 * that stretch reaches no building at all, in any direction. A snap-only gate
 * offered the pill there and the press drew nothing, which is the dead press
 * this rule exists to prevent. So it runs the router: is there a walk from
 * here to the building this lesson is in?
 *
 * Per BUILDING, not per position, for the same reason. Budova Z has no nodes,
 * so no walk to it exists from anywhere, and asking about the student's own
 * lecture keeps the offer honest rather than merely plausible.
 *
 * Every gate open, matching `routeTo` — while the walk itself is being
 * perfected the hours are not consulted, and a gate that said yes here and no
 * on the press would be the same dead press by another road.
 *
 * `null` is not a no. No fix means the student was never asked for their
 * location, and hiding the offer on a guess would take the feature away from
 * someone standing on the campus.
 */
export function canRouteFrom(at: [number, number] | null, buildingName: string): boolean {
  if (!at) return true;
  const snap = snapToGraph(GRAPH, at);
  if (!snap) return false;
  return shortestWalk(GRAPH, snap, GRAPH.buildings[buildingName] ?? [], () => true) !== null;
}
