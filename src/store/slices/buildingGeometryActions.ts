import type { AppSlice, MapSlice } from '../types';
import type { RoomIndexEntry } from '../../types/campusMap';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { fetchBuildingRooms } from '../../api/campusMap';
import { fetchBuildingModel } from '../../api/buildingModels';
import { hasBuildingModel } from '../../data/map/buildingModels';
import { lookupRoomEntry } from '../../utils/rooms/lookupRoom';
import { logError } from '../../utils/reportError';

const INDEX = roomsIndexJson as RoomIndexEntry[];

/**
 * Loading a building's floor plan, split out of `createMapSlice` — which was
 * already 350 lines before this responsibility arrived.
 *
 * It is a slice creator rather than a plain helper so the in-flight map below
 * lives in a factory closure, one per store, the way `createRsvpSlice` holds
 * its own. At module scope it would be shared by every store ever created,
 * including between tests. `createMapSlice` spreads the result; nothing else
 * composes it, so it is not registered in `useAppStore` on its own.
 */
export const createBuildingGeometryActions: AppSlice<
  Pick<MapSlice, 'loadMapBuilding' | 'loadRoomGeometry' | 'loadBuildingModel'>
> = (set, get) => {
  // Requests started but not finished, so a second caller joins the first
  // instead of racing it. Cleared in `finally`, including on failure.
  const inFlight = new Map<number, Promise<void>>();
  const modelsInFlight = new Map<number, Promise<void>>();

  return {
    loadMapBuilding: async (id) => {
      // The 3D card wants the model whenever it wants the floor plan, so every
      // hover and map selection that loads one asks for the other. Not awaited:
      // the flat plan must never wait on the model.
      void get().loadBuildingModel(id);
      if (get().roomsByBuilding[id]) return; // already in memory
      // ...and if it is already on its way, wait for THAT rather than starting
      // a second download of the same geojson. The stored-geometry check above
      // cannot see a request still in flight, so two hover cards opened in one
      // building a moment apart used to fetch it twice on a cold cache.
      const pending = inFlight.get(id);
      if (pending) return pending;

      set({ mapLoadingBuilding: id });
      const request = (async () => {
        try {
          const data = await fetchBuildingRooms(id);
          if (data) set({ roomsByBuilding: { ...get().roomsByBuilding, [id]: data } });
        } catch (err) {
          logError('MapSlice.loadMapBuilding', err);
        } finally {
          // Cleared before the state update so a retry after a failure is
          // never blocked by the attempt that failed.
          inFlight.delete(id);
          set({
            mapLoadingBuilding: get().mapLoadingBuilding === id ? null : get().mapLoadingBuilding,
          });
        }
      })();
      inFlight.set(id, request);
      return request;
    },

    loadBuildingModel: async (id) => {
      if (!hasBuildingModel(id) || get().buildingModels[id]) return;
      const pending = modelsInFlight.get(id);
      if (pending) return pending;
      const request = (async () => {
        try {
          const model = await fetchBuildingModel(id);
          set({ buildingModels: { ...get().buildingModels, [id]: model ?? 'failed' } });
        } catch (err) {
          logError('MapSlice.loadBuildingModel', err);
          set({ buildingModels: { ...get().buildingModels, [id]: 'failed' } });
        } finally {
          modelsInFlight.delete(id);
        }
      })();
      modelsInFlight.set(id, request);
      return request;
    },

    // The hover card knows a room string ("A01", "Q01 (Poříčí)"); the loader
    // wants a building id. Resolving between the two used to sit in
    // RoomThumbnail, which then fetched from a useEffect — the Iron Rule says a
    // component must not. The hover is the intent, so MapHoverCard calls this
    // and the component is left reading the store synchronously.
    loadRoomGeometry: async (roomName) => {
      const entry = lookupRoomEntry(roomName, INDEX);
      if (!entry) return; // nothing to draw; the card shows its dash
      await get().loadMapBuilding(entry.buildingId);
    },
  };
};
