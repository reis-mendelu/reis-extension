import campusPaths from '../../data/map/campusPaths.json';
import type { AppSlice } from '../types';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from '../../utils/routing/snapToGraph';
import { shortestWalk, type Walk } from '../../utils/routing/shortestWalk';
import { currentPosition } from '../../utils/routing/position';
import { quietPosition } from '../../utils/routing/quietPosition';
import { canRouteFrom } from '../../utils/routing/routableStart';
import { isGateOpen } from '../../utils/routing/gateHours';
import { devForcedNow } from '../../utils/routing/devPosition';
import type { RouteTarget } from '../../utils/routing/nextLessonTarget';
import { logError } from '../../utils/reportError';

const GRAPH = (campusPaths as unknown as { graph: CampusGraph }).graph;

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

    // A NEW lesson retires the walk drawn for the previous one. Measured:
    // walk to Q16, back to the timetable, tap Q02's pin — and Q16's line was
    // still on the map with no pill on Q02, because the offer is suppressed
    // while a walk exists. The only way out was to press × first, which is a
    // dead end nobody would guess at.
    //
    // Only for a real target: `suggestRoute(null)` is what leaving the map tab
    // does, and a student who comes back should find the line they asked for
    // still there.
    routeGeneration++;
    set({ routeFrom: null, routeWalk: null, routeStatus: 'idle', routeTargetBuilding: null });
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
    set({ canRouteFromHere: canRouteFrom(at, target.buildingName) });
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

    // The garden's hours are consulted (po–pá 6:00–20:00, ISIC at the gate —
    // see gateHours.ts). For a while they were not, and at 23:14 on a Sunday
    // this drew a walk through a garden nobody can enter; a line on the map
    // reads as an instruction. A shut gate is simply not an edge: the walk
    // goes around it where there is a way, and where there is none — FRRMS at
    // night — there is no walk, and the reason goes to the log below with the
    // other failures. The tram sentence that once explained it is not back.
    const now = devForcedNow() ?? new Date();
    const targets = GRAPH.buildings[buildingName] ?? [];
    const walk = shortestWalk(GRAPH, snap, targets, (gate) => isGateOpen(gate, now));
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
    // `routeSuggestion` SURVIVES. The × means "take this line off the map",
    // not "forget which lecture I was going to": clearing both made it a
    // one-way door — measured on the flow, after dismissing there was no pill
    // and no other route control anywhere on the map, the room still selected,
    // and the only way back was the timetable. Keeping it puts the offer back
    // on the room, so a dismissal is reversible with one tap.
    //
    // `canRouteFromHere` does NOT survive, for the same reason: the student
    // may have dismissed the line and walked somewhere the next press cannot
    // start from, so the next offer asks again rather than trusting an answer
    // given to a walk that is over. It is left permissive, as it starts.
    set({
      routeFrom: null,
      routeWalk: null,
      routeStatus: 'idle',
      routeTargetBuilding: null,
      canRouteFromHere: true,
      routePickerOpen: false,
    });
  },
});
