import type { AppSlice, MapSlice } from '../types';
import type { BuildingsMeta, RoomIndexEntry, PoiFeature, MapSelection, Landmark } from '../../types/campusMap';
import buildingsJson from '../../data/map/buildings.json';
import roomsIndexJson from '../../data/map/rooms-index.json';
import poisJson from '../../data/map/pois.json';
import landmarksJson from '../../data/map/landmarks.json';
import { searchPlaces, polygonCentroid } from '../../components/CampusMap/mapHelpers';
import { fetchBuildingRooms } from '../../api/campusMap';
import { fetchMapEvents } from '../../api/mapEvents';
import { logError } from '../../utils/reportError';

const META = buildingsJson as BuildingsMeta;
const INDEX = roomsIndexJson as RoomIndexEntry[];
const POIS = (poisJson as unknown as { features: PoiFeature[] }).features;
const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;

const buildingById = (id: number) => META.buildings.find((b) => b.id === id) ?? null;

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
  mapPanelTab: 'places',
  eventFilter: 'all',

  setMapBuilding: (id) => {
    const b = buildingById(id);
    if (!b) return;
    set({ activeBuildingId: id, activeFloorId: b.defaultFloorId ?? b.floors[0]?.id ?? null, mapSelection: null });
    void get().loadMapBuilding(id);
  },

  exitToCampus: () => set({ activeBuildingId: null, activeFloorId: null, mapSelection: null }),

  clearMapSelection: () => set({ mapSelection: null }),

  setMapFloor: (floorId) => set({ activeFloorId: floorId, mapSelection: null }),

  selectMapRoom: (room) => set({ mapSelection: { kind: 'room', room } }),
  selectMapPoi: (poi, coord) => set({ mapSelection: { kind: 'poi', poi, coord } }),

  setMapSearchQuery: (q) => set({ mapSearchQuery: q, mapSearchResults: searchPlaces(q, INDEX, POIS, LANDMARKS) }),

  focusRoomByCode: (code) => {
    const entry = INDEX.find((e) => e.code === code || e.name === code);
    if (!entry) { logError('MapSlice.focusRoomByCode', new Error(`unknown room ${code}`)); return; }
    const b = buildingById(entry.buildingId);
    set({
      activeBuildingId: entry.buildingId,
      activeFloorId: entry.floorId,
      mapSelection: { kind: 'roomRef', entry } as MapSelection,
      mapFocusRequest: get().mapFocusRequest + 1,
    });
    if (b) void get().loadMapBuilding(entry.buildingId);
  },

  focusPoiById: (id) => {
    const f = POIS.find((p) => p.properties.id === id);
    if (!f) { logError('MapSlice.focusPoiById', new Error(`unknown poi ${id}`)); return; }
    set({
      activeBuildingId: null, activeFloorId: null,
      mapSelection: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates },
      mapFocusRequest: get().mapFocusRequest + 1,
    });
  },

  focusLandmarkById: (id) => {
    const l = LANDMARKS.find((x) => x.id === id);
    if (!l) { logError('MapSlice.focusLandmarkById', new Error(`unknown landmark ${id}`)); return; }
    const coord = polygonCentroid(l.outline.coordinates[0]);
    set({
      activeBuildingId: null, activeFloorId: null,
      mapSelection: { kind: 'poi', poi: { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email }, coord },
      mapFocusRequest: get().mapFocusRequest + 1,
    });
  },

  focusCampus: () => set({
    activeBuildingId: null, activeFloorId: null, mapSelection: null,
    mapFocusRequest: get().mapFocusRequest + 1,
  }),

  focusPoint: (name, coord) => set({
    activeBuildingId: null, activeFloorId: null,
    mapSelection: { kind: 'poi', poi: { id: -1, name, type: '', url: null, phone: null, email: null }, coord },
    mapFocusRequest: get().mapFocusRequest + 1,
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
      set({ mapLoadingBuilding: get().mapLoadingBuilding === id ? null : get().mapLoadingBuilding });
    }
  },

  setMapPanelTab: (tab) => set({ mapPanelTab: tab }),
  setEventFilter: (filter) => set({ eventFilter: filter }),

  loadMapEvents: async () => {
    if (get().mapEventsLoaded) return;
    try {
      const events = await fetchMapEvents(get().language);
      set({ mapEvents: events, mapEventsLoaded: true });
    } catch (err) {
      logError('MapSlice.loadMapEvents', err);
    }
  },

  focusEventById: (id) => {
    const event = get().mapEvents.find((e) => e.id === id);
    if (!event) { logError('MapSlice.focusEventById', new Error(`unknown event ${id}`)); return; }
    // Off-campus events have no pin and don't move the camera — they still open
    // in the detail panel so the row is clickable everywhere.
    set({
      activeBuildingId: null, activeFloorId: null,
      mapSelection: { kind: 'event', event },
      mapFocusRequest: event.coord ? get().mapFocusRequest + 1 : get().mapFocusRequest,
    });
  },
});
