import campusPaths from '../../data/map/campusPaths.json';
import type { AppSlice } from '../types';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from '../../utils/routing/snapToGraph';
import { shortestWalk, type Walk } from '../../utils/routing/shortestWalk';
import { isGateOpen } from '../../utils/routing/gateHours';
import { currentPosition, NO_PLATFORM } from '../../utils/routing/position';
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
  /** This build cannot ask for a position at all. */
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
  /** Whether the destination picker is showing. In the store, not in a component. */
  routePickerOpen: boolean;
  setRoutePickerOpen: (open: boolean) => void;
  routeTo: (buildingName: string) => Promise<void>;
  clearRoute: () => void;
}

export const createRouteSlice: AppSlice<RouteSlice> = (set) => ({
  routeFrom: null,
  routeWalk: null,
  routeStatus: 'idle',
  routeTargetBuilding: null,
  routePickerOpen: false,

  setRoutePickerOpen: (open) => set({ routePickerOpen: open }),

  routeTo: async (buildingName) => {
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
      // "You said no" and "this build cannot ask" are different answers, and
      // the student deserves to be told which one they are looking at.
      const noPlatform = String((err as Error)?.message ?? '').includes(NO_PLATFORM);
      set({ routeStatus: noPlatform ? 'unavailable' : 'denied' });
      return;
    }

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

  clearRoute: () =>
    set({
      routeFrom: null,
      routeWalk: null,
      routeStatus: 'idle',
      routeTargetBuilding: null,
      routePickerOpen: false,
    }),
});
