import type { AppSlice, MapSlice } from '../types';
import type {
  BuildingsMeta,
  RoomIndexEntry,
  PoiFeature,
  MapSelection,
  Landmark,
  RemotePlace,
} from '../../types/campusMap';
import type { MapEvent } from '../../types/events';
import buildingsJson from '../../data/map/buildings.json';
import roomsIndexJson from '../../data/map/rooms-index.json';
import poisJson from '../../data/map/pois.json';
import landmarksJson from '../../data/map/landmarks.json';
import remotePlacesJson from '../../data/map/remotePlaces.json';
import {
  searchPlaces,
  polygonCentroid,
  remotePlaceCenter,
  roomCodeToCoord,
} from '../../components/CampusMap/mapHelpers';
import { fetchBuildingRooms } from '../../api/campusMap';
import { fetchMapEvents, toMapEvent } from '../../api/mapEvents';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';
import { indexAvailabilityByRoom } from '@/data/map/libraryRooms';
import { createLibraryBooking } from '@/api/libraryBooking';
import { buildBookingRequest } from '@/services/library/bookingRequest';
import { logError } from '../../utils/reportError';

const META = buildingsJson as BuildingsMeta;
const INDEX = roomsIndexJson as RoomIndexEntry[];
const POIS = (poisJson as unknown as { features: PoiFeature[] }).features;
const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const REMOTE = (remotePlacesJson as { places: RemotePlace[] }).places;

const buildingById = (id: number) => META.buildings.find((b) => b.id === id) ?? null;

// Campus events carry a room code but no coordinate; resolve it to the building
// centre so they can be pinned. Off-campus/online events keep their own coord (or none).
function locateEvent(e: MapEvent): MapEvent {
  return e.coord || e.venueKind !== 'campus' || !e.roomCode
    ? e
    : { ...e, coord: roomCodeToCoord(e.roomCode, INDEX, META) };
}

export const createMapSlice: AppSlice<MapSlice> = (set, get) => ({
  activeBuildingId: null,
  activeFloorId: null,
  mapSelection: null,
  roomsByBuilding: {},
  mapLoadingBuilding: null,
  mapSearchQuery: '',
  mapSearchResults: [],
  mapFocusRequest: 0,
  mapEvents: [],
  mapEventsLoaded: false,
  libraryAvailability: {},
  libraryAvailabilityLoaded: false,
  bookingStatus: {},
  bookingError: {},
  mapPanelTab: 'events',
  eventFilter: 'all',
  societyMapEvents: [],
  placingEvent: false,
  draftCoord: null,
  draftFocusRequest: 0,
  mapFocusTarget: 'campus',
  composerOpen: false,
  editEventId: null,

  setMapBuilding: (id) => {
    const b = buildingById(id);
    if (!b) return;
    set({
      activeBuildingId: id,
      activeFloorId: b.defaultFloorId ?? b.floors[0]?.id ?? null,
      mapSelection: null,
    });
    void get().loadMapBuilding(id);
  },

  exitToCampus: () => set({ activeBuildingId: null, activeFloorId: null, mapSelection: null }),

  clearMapSelection: () => set({ mapSelection: null }),

  openLibraryOverview: () => set({ mapSelection: { kind: 'libraryOverview' } }),

  setMapFloor: (floorId) => set({ activeFloorId: floorId, mapSelection: null }),

  selectMapRoom: (room) => set({ mapSelection: { kind: 'room', room } }),
  selectMapPoi: (poi, coord) => set({ mapSelection: { kind: 'poi', poi, coord } }),

  setMapSearchQuery: (q) =>
    set({ mapSearchQuery: q, mapSearchResults: searchPlaces(q, INDEX, POIS, LANDMARKS) }),

  focusRoomByCode: (code) => {
    const entry = INDEX.find((e) => e.code === code || e.name === code);
    if (!entry) {
      logError('MapSlice.focusRoomByCode', new Error(`unknown room ${code}`));
      return;
    }
    const b = buildingById(entry.buildingId);
    set({
      activeBuildingId: entry.buildingId,
      activeFloorId: entry.floorId,
      mapSelection: { kind: 'roomRef', entry } as MapSelection,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    });
    if (b) void get().loadMapBuilding(entry.buildingId);
  },

  focusPoiById: (id) => {
    const f = POIS.find((p) => p.properties.id === id);
    if (!f) {
      logError('MapSlice.focusPoiById', new Error(`unknown poi ${id}`));
      return;
    }
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates },
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    });
  },

  focusLandmarkById: (id) => {
    const l = LANDMARKS.find((x) => x.id === id);
    if (!l) {
      logError('MapSlice.focusLandmarkById', new Error(`unknown landmark ${id}`));
      return;
    }
    const coord = polygonCentroid(l.outline.coordinates[0]!); // safe: GeoJSON Polygon always has >=1 ring
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: {
        kind: 'poi',
        poi: { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email },
        coord,
      },
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    });
  },

  focusRemotePlaceById: (id) => {
    const p = REMOTE.find((x) => x.id === id);
    if (!p) {
      logError('MapSlice.focusRemotePlaceById', new Error(`unknown remote place ${id}`));
      return;
    }
    // Reuse the poi selection kind: the overview effect flies to the footprint
    // centre and DetailPanel renders name (title) / address (type slot) /
    // website (url).
    const coord = remotePlaceCenter(p);
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: {
        kind: 'poi',
        poi: {
          id: p.id,
          name: p.name,
          type: p.address ?? '',
          url: p.url,
          phone: null,
          email: null,
        },
        coord,
      },
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    });
  },

  focusCampus: () =>
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: null,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    }),

  focusPoint: (name, coord) =>
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: {
        kind: 'poi',
        poi: { id: -1, name, type: '', url: null, phone: null, email: null },
        coord,
      },
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    }),

  loadMapBuilding: async (id) => {
    if (get().roomsByBuilding[id]) return; // already in memory
    set({ mapLoadingBuilding: id });
    try {
      const data = await fetchBuildingRooms(id);
      if (data) set({ roomsByBuilding: { ...get().roomsByBuilding, [id]: data } });
    } catch (err) {
      logError('MapSlice.loadMapBuilding', err);
    } finally {
      set({
        mapLoadingBuilding: get().mapLoadingBuilding === id ? null : get().mapLoadingBuilding,
      });
    }
  },

  setMapPanelTab: (tab) => set({ mapPanelTab: tab }),
  setEventFilter: (filter) => set({ eventFilter: filter }),

  refreshSocietyMapEvents: () => {
    const rows = get().societyPosts;
    set({ societyMapEvents: rows.map((r) => locateEvent(toMapEvent(r))) });
  },

  beginPlacing: () =>
    set({
      placingEvent: true,
      mapSelection: null,
      activeBuildingId: null,
      activeFloorId: null,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus' as const,
    }),
  cancelPlacing: () => set({ placingEvent: false }),
  placeDraftCoord: (coord) => set({ draftCoord: coord, placingEvent: false }),
  clearDraftCoord: () => set({ draftCoord: null }),

  // Two counters, on purpose, because two different things have to happen.
  //
  // `mapFocusRequest` is the one MapCanvas's draw effect consumes, and moving
  // the camera through it is what makes this work at all. The first version
  // used a separate hook that called setView on the Leaflet instance itself,
  // and lost a race that is invisible from the calling side: MapCanvas's draw
  // effect ends by fitting the whole campus on mount, and it runs AFTER the
  // setMapInstance subscriber that fired the setView. The pin appeared and the
  // camera stayed on the campus overview. One owner of the camera, not two.
  //
  // `draftFocusRequest` is for the phone's console shell, which has to bring
  // the map TAB forward — a camera move behind a hidden pane is invisible.
  //
  // Clearing the selection matters: MapCanvas's camera chain checks poi and
  // event before anything else, so a live selection would claim the move.
  // Leaving floor view matters for the same reason the pin does — pins are
  // only drawn in the campus overview.
  previewDraftOnMap: () =>
    set({
      draftFocusRequest: get().draftFocusRequest + 1,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'draft' as const,
      mapSelection: null,
      activeBuildingId: null,
      activeFloorId: null,
    }),

  openComposer: (editId) => {
    const ev = editId ? get().societyMapEvents.find((e) => e.id === editId) : null;
    set({ composerOpen: true, editEventId: editId ?? null, draftCoord: ev?.coord ?? null });
  },
  closeComposer: () =>
    set({
      composerOpen: false,
      editEventId: null,
      placingEvent: false,
      draftCoord: null,
      // The draft is gone, so the camera has nothing to point at any more.
      mapFocusTarget: 'campus',
    }),

  loadMapEvents: async () => {
    if (get().mapEventsLoaded) return; // boot-time load: once is enough
    await get().reloadMapEvents();
  },

  // Refetch the public feed unconditionally. The load-once guard in
  // loadMapEvents means the boot snapshot never refreshes on its own, so a
  // society publishing/deleting an event would otherwise not surface on the
  // public map/"Akce" tab until a full reload — call this after those mutations.
  reloadMapEvents: async () => {
    try {
      const events = await fetchMapEvents();
      set({ mapEvents: events.map(locateEvent), mapEventsLoaded: true });
      // Attendance is loaded here, with the events, rather than by the cards:
      // one RPC covers every visible event, and components do not fetch.
      // Detached on purpose — a card renders with 0/0 while this is in flight,
      // and a failure must not take the events down with it.
      void get().loadRsvps(events.map((e) => e.id));
    } catch (err) {
      logError('MapSlice.reloadMapEvents', err);
    }
  },

  loadLibraryAvailability: async () => {
    if (get().libraryAvailabilityLoaded) return;
    // fetchLibraryAvailability never throws — it logs and returns [] on failure.
    const rooms = await fetchLibraryAvailability();
    // The API returns all rooms under one shared staff GUID; index by each room's
    // own per-room staffGuid (matched on serviceId) so every reader's
    // `availability[room.staffGuid]` lookup resolves. See indexAvailabilityByRoom.
    set({ libraryAvailability: indexAvailabilityByRoom(rooms), libraryAvailabilityLoaded: true });
  },

  bookRoom: async (room, slotIso, identity) => {
    const key = `${room.staffGuid}|${slotIso}`;
    set((s) => ({ bookingStatus: { ...s.bookingStatus, [key]: 'submitting' } }));
    const req = buildBookingRequest(room, slotIso, identity);
    const result = await createLibraryBooking(req);
    if (result.ok) {
      set((s) => ({ bookingStatus: { ...s.bookingStatus, [key]: 'success' } }));
      // Reset the load-once guard so the panel reflects the new booking.
      set({ libraryAvailabilityLoaded: false });
      await get().loadLibraryAvailability();
    } else {
      set((s) => ({
        bookingStatus: { ...s.bookingStatus, [key]: 'error' },
        bookingError: { ...s.bookingError, [key]: result.error },
      }));
    }
  },

  focusEventById: (id, opts) => {
    const pool = get().adminConsoleOpen ? get().societyMapEvents : get().mapEvents;
    const event = pool.find((e) => e.id === id);
    if (!event) {
      logError('MapSlice.focusEventById', new Error(`unknown event ${id}`));
      return;
    }
    // A PIN click (no opts) never moves the camera — you're already looking at the
    // pin, so we just open the detail panel and highlight it. Leaving
    // activeBuildingId at null and not bumping mapFocusRequest keeps the redraw
    // effect from re-running in the overview, so the screen stays put.
    // A LIST click passes { fly: true }: for an on-campus event we bump
    // mapFocusRequest so the canvas flies to its coordinate; off-campus events
    // have no coord, so they only open the panel wherever the map already is.
    const fly = opts?.fly === true && !!event.coord;
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: { kind: 'event', event },
      ...(fly
        ? { mapFocusRequest: get().mapFocusRequest + 1, mapFocusTarget: 'campus' as const }
        : {}),
    });
  },
});
