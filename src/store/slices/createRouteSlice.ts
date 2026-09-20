import campusPaths from '../../data/map/campusPaths.json';
import type { AppSlice } from '../types';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from '../../utils/routing/snapToGraph';
import { shortestWalk, type Walk } from '../../utils/routing/shortestWalk';
import { isGateOpen } from '../../utils/routing/gateHours';
import { currentPosition, isPermissionDenied, NO_PLATFORM } from '../../utils/routing/position';
import type { RouteTarget } from '../../utils/routing/nextLessonTarget';
import { devForcedNow } from '../../utils/routing/devPosition';
import { logError } from '../../utils/reportError';

const GRAPH = (campusPaths as unknown as { graph: CampusGraph }).graph;

export type RouteStatus =
  | 'idle'
  | 'locating'
  /** A walk was found and is on the map. */
  | 'ready'
  /** The student refused the permission, or the fix could not be had. */
  | 'denied'
  /**
   * No position to be had: this build cannot ask, or the fix timed out, or no
   * provider answered. Distinct from `denied`, which means the student
   * refused — sending them to a settings screen they never touched is worse
   * than saying nothing.
   */
  | 'unavailable'
  /** The fix landed too far from the network to route from. */
  | 'too-far'
  /** Snapped fine, but nothing walkable reaches the destination right now. */
  | 'no-route'
  /**
   * No walk NOW, but there is one while the garden is open.
   *
   * Distinct from `no-route` because the answers differ: this one can name the
   * tram, the other cannot. Conflating them told a student standing on a
   * disconnected stretch of path that the botanical garden was shut.
   */
  | 'gate-shut';

export interface RouteSlice {
  /** The raw fix, kept so the UI can say how far off the network it was. */
  routeFrom: [number, number] | null;
  routeWalk: Walk | null;
  routeStatus: RouteStatus;
  routeTargetBuilding: string | null;
  /**
   * The lesson the student pointed at, waiting to be offered as a walk.
   *
   * Set by the pin beside a timetable row, NOT by the map itself: without it
   * the route button can only ever answer "where am I going now?", so tapping
   * the pin on Thursday's lecture and then asking for a route walked you to
   * whatever is next today — a different lesson, in a different building, with
   * nothing on screen admitting the swap.
   *
   * Holding it here rather than firing `routeTo` on arrival is deliberate: the
   * fix is a permission prompt, and a pin tap must not spend one. The
   * suggestion is a button; the prompt is what pressing it costs.
   */
  routeSuggestion: RouteTarget | null;
  suggestRoute: (target: RouteTarget | null) => void;
  /** Whether the destination picker is showing. In the store, not in a component. */
  routePickerOpen: boolean;
  setRoutePickerOpen: (open: boolean) => void;
  routeTo: (buildingName: string) => Promise<void>;
  clearRoute: () => void;
}

/**
 * Which request the store is currently waiting on.
 *
 * `clearRoute` stays available while a fix is in flight — the close button is
 * right there — and two `routeTo` calls can finish out of order. Without this,
 * a request the student cancelled comes back from its await and sets `ready`
 * over the idle state they asked for. Module-scope rather than store state
 * because it is bookkeeping, not something any component renders.
 */
let routeGeneration = 0;

export const createRouteSlice: AppSlice<RouteSlice> = (set) => ({
  routeFrom: null,
  routeWalk: null,
  routeStatus: 'idle',
  routeTargetBuilding: null,
  routeSuggestion: null,
  routePickerOpen: false,

  suggestRoute: (target) => set({ routeSuggestion: target }),

  // Opening the picker is the student saying "not that one". Keeping the
  // suggestion alive through it would put the lecture back over the library
  // they just chose, on the very next render.
  setRoutePickerOpen: (open) =>
    set(open ? { routePickerOpen: true, routeSuggestion: null } : { routePickerOpen: false }),

  routeTo: async (buildingName) => {
    const mine = ++routeGeneration;
    const stale = () => mine !== routeGeneration;

    // The previous walk is dropped BEFORE the await, not after. Left up, it
    // would sit on the map under the new destination's heading for as long as
    // the fix takes — a route to somewhere the student is no longer going.
    set({
      routeStatus: 'locating',
      routeTargetBuilding: buildingName,
      routeWalk: null,
      routeFrom: null,
    });

    let at: [number, number];
    try {
      at = await currentPosition();
    } catch (err) {
      logError('RouteSlice.locate', err);
      if (stale()) return;
      // `denied` ONLY for an actual refusal. The plugin also rejects on its
      // 10-second timeout and when no provider answers, and the first version
      // called all of those "denied" — so a student on a cold GPS fix was told
      // to go and change a permission they had already granted.
      const noPlatform = String((err as Error)?.message ?? '').includes(NO_PLATFORM);
      set({ routeStatus: !noPlatform && isPermissionDenied(err) ? 'denied' : 'unavailable' });
      return;
    }

    if (stale()) return;

    const snap = snapToGraph(GRAPH, at);
    if (!snap) {
      set({ routeFrom: at, routeStatus: 'too-far' });
      return;
    }

    const now = devForcedNow() ?? new Date();
    const targets = GRAPH.buildings[buildingName] ?? [];
    const walk = shortestWalk(GRAPH, snap, targets, (gate) => isGateOpen(gate, now));
    if (!walk) {
      // Ask the same question again with every gate open. If a walk appears,
      // the gate is the whole reason there isn't one — and that is a different
      // answer for the student, because it comes with a tram. If none appears,
      // there is genuinely nowhere to walk from here and saying "the garden is
      // shut" would be a lie.
      // Asked again with every gate open, only to tell the two silences apart:
      // a walk that appears means the GATE is the reason there isn't one, and
      // that answer comes with a tram. The would-be walk itself is not drawn —
      // a grey line through a garden nobody can enter looked like an
      // instruction, and the honest answer at that moment is the tram, not a
      // path the student cannot take.
      const ifOpen = shortestWalk(GRAPH, snap, targets, () => true);
      set({ routeFrom: at, routeStatus: ifOpen ? 'gate-shut' : 'no-route' });
      return;
    }
    set({ routeFrom: at, routeWalk: walk, routeStatus: 'ready' });
  },

  clearRoute: () => {
    // Anything still in flight now belongs to nobody.
    routeGeneration++;
    set({
      routeFrom: null,
      routeWalk: null,
      routeStatus: 'idle',
      routeTargetBuilding: null,
      routeSuggestion: null,
      routePickerOpen: false,
    });
  },
});
