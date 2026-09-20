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
  | 'no-route';

export interface RouteSlice {
  /** The raw fix, kept so the UI can say how far off the network it was. */
  routeFrom: [number, number] | null;
  routeWalk: Walk | null;
  routeStatus: RouteStatus;
  routeTargetBuilding: string | null;
  routeTo: (buildingName: string) => Promise<void>;
  clearRoute: () => void;
}

export const createRouteSlice: AppSlice<RouteSlice> = (set) => ({
  routeFrom: null,
  routeWalk: null,
  routeStatus: 'idle',
  routeTargetBuilding: null,

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
    const walk = shortestWalk(GRAPH, snap, GRAPH.buildings[buildingName] ?? [], (gate) =>
      isGateOpen(gate, now)
    );
    if (!walk) {
      set({ routeFrom: at, routeStatus: 'no-route' });
      return;
    }
    set({ routeFrom: at, routeWalk: walk, routeStatus: 'ready' });
  },

  clearRoute: () =>
    set({ routeFrom: null, routeWalk: null, routeStatus: 'idle', routeTargetBuilding: null }),
});
