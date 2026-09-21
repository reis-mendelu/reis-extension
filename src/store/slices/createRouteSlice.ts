import campusPaths from '../../data/map/campusPaths.json';
import type { AppSlice } from '../types';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from '../../utils/routing/snapToGraph';
import { shortestWalk, type Walk } from '../../utils/routing/shortestWalk';
import { currentPosition } from '../../utils/routing/position';
import { quietPosition } from '../../utils/routing/quietPosition';
import { canRouteFrom } from '../../utils/routing/routableStart';
import type { RouteTarget } from '../../utils/routing/nextLessonTarget';
import { logError } from '../../utils/reportError';

const GRAPH = (campusPaths as unknown as { graph: CampusGraph }).graph;

/** The gate predicate the router takes, answering yes to all of them. Named so
 *  the call site reads as a decision rather than as a stray `() => true`. */
const ALL_GATES_OPEN = () => true;

/**
 * Four states, and only two of them reach the screen.
 *
 * There used to be seven: `denied`, `unavailable`, `too-far`, `no-route` and
 * `gate-shut` each existed to be SAID, in a card that explained which of them
 * had happened. That card is gone while the walk itself is being perfected, so
 * a distinction nothing can express is a distinction not worth keeping — every
 * way of not getting a walk is `failed`, and the reason goes to the console
 * (logcat on the device) where it can still be recovered.
 */
export type RouteStatus =
  | 'idle'
  | 'locating'
  /** A walk was found and is on the map. */
  | 'ready'
  /** No walk, for any reason. The reason is in the log, never on screen. */
  | 'failed';

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
  /**
   * Whether a walk could be built from where the student is standing.
   *
   * `true` until something says otherwise, and "not knowing" stays `true` on
   * purpose: the fix behind it is only taken when the permission was already
   * granted, so on a device that never granted it this is simply never
   * answered — and hiding the offer on a guess would take the feature away
   * from someone standing on the campus.
   */
  canRouteFromHere: boolean;
  /** Sets the offer, and quietly asks whether it is worth making. */
  suggestRoute: (target: RouteTarget | null) => Promise<void>;
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

/**
 * The same bookkeeping for the offer's own quiet fix.
 *
 * Two lesson pins tapped in quick succession leave two fixes in flight, and
 * they can land out of order. A guard that only asked "is there a suggestion?"
 * was satisfied by the SECOND one, so the first came back and answered a
 * question nobody was asking any more — measured: a stale fix from across the
 * city withdrew an offer that was valid where the student actually stood.
 */
let suggestGeneration = 0;

export const createRouteSlice: AppSlice<RouteSlice> = (set, get) => ({
  routeFrom: null,
  routeWalk: null,
  routeStatus: 'idle',
  routeTargetBuilding: null,
  routeSuggestion: null,
  canRouteFromHere: true,
  routePickerOpen: false,

  suggestRoute: async (target) => {
    const mine = ++suggestGeneration;
    set({ routeSuggestion: target, canRouteFromHere: true });
    if (!target) return;
    // Quietly, and only if the permission is already there — the prompt
    // belongs to the press. A student across the city is not offered a walk
    // that could only fail; see canRouteFrom for why this asks the router
    // rather than measuring a radius.
    const at = await quietPosition();
    // This exact offer, not merely "an offer". It may have been retired while
    // the fix was in flight — a tab switch, another room tapped, the route
    // cleared — or overtaken by a newer one, and answering for either would
    // decide the wrong question.
    if (mine !== suggestGeneration || !get().routeSuggestion) return;
    set({ canRouteFromHere: canRouteFrom(at) });
  },

  // Opening the picker is the student saying "not that one". Keeping the
  // suggestion alive through it would put the lecture back over the library
  // they just chose, on the very next render.
  setRoutePickerOpen: (open) =>
    set(open ? { routePickerOpen: true, routeSuggestion: null } : { routePickerOpen: false }),

  routeTo: async (buildingName) => {
    const mine = ++routeGeneration;
    const stale = () => mine !== routeGeneration;

    // The previous walk is dropped BEFORE the await, not after. Left up, it
    // would sit on the map under the new destination for as long as the fix
    // takes — a route to somewhere the student is no longer going.
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
      // Refusal, cold fix, plugin timeout, a browser with no native
      // geolocation — all one outcome now, and the only place they are still
      // told apart is this line.
      logError('RouteSlice.locate', err);
      if (stale()) return;
      set({ routeStatus: 'failed' });
      return;
    }

    if (stale()) return;

    const snap = snapToGraph(GRAPH, at);
    if (!snap) {
      // The REASON, never the coordinates. Nothing here leaves the device, but
      // the position is the one thing in this feature worth not writing down at
      // all — logcat is readable over adb, and the destination alone is enough
      // to tell this failure from the others.
      logError('RouteSlice.snap', new Error('fix too far from the path network'));
      set({ routeFrom: at, routeStatus: 'failed' });
      return;
    }

    // EVERY gate open, whatever the clock says. The garden's hours
    // (po–pá 6:00–20:00) are real and `gateHours` still knows them, but they
    // are not consulted while the walk is being perfected: a shut garden is
    // the difference between a line and a sentence about tram 9, and the
    // sentence is one of the things that went. Measured consequence, recorded
    // so it is not rediscovered as a surprise — at 23:14 on a Sunday this now
    // draws a walk through a garden nobody can enter.
    const targets = GRAPH.buildings[buildingName] ?? [];
    const walk = shortestWalk(GRAPH, snap, targets, ALL_GATES_OPEN);
    if (!walk) {
      logError('RouteSlice.route', new Error(`no walk to ${buildingName}`));
      set({ routeFrom: at, routeStatus: 'failed' });
      return;
    }
    set({ routeFrom: at, routeWalk: walk, routeStatus: 'ready' });
  },

  clearRoute: () => {
    // Anything still in flight now belongs to nobody — the walk's fix and the
    // offer's alike.
    routeGeneration++;
    suggestGeneration++;
    set({
      routeFrom: null,
      routeWalk: null,
      routeStatus: 'idle',
      routeTargetBuilding: null,
      routeSuggestion: null,
      canRouteFromHere: true,
      routePickerOpen: false,
    });
  },
});
