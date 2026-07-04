import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));
vi.mock('../../../api/mapEvents', () => ({ fetchMapEvents: vi.fn() }));
import { fetchBuildingRooms } from '../../../api/campusMap';
import { fetchMapEvents } from '../../../api/mapEvents';
import { useAppStore } from '../../useAppStore';
import type { RoomsCollection } from '../../../types/campusMap';
import type { MapEvent } from '../../../types/events';

// Fixture standing in for the real Supabase-backed fetchMapEvents (Task 13) —
// one on-campus event (has a coord, so it's pin-able) and one off-campus
// event (no coord), matching the variety the store-level tests exercise.
const MOCK_EVENTS: MapEvent[] = [
  { id: 'ev-1', title: 'PEF Kvíz', url: '', date: '2026-07-10', endDate: null, time: '18:00',
    location: null, imageUrl: null, organizerKey: 'pef', societyId: 'supef',
    coord: [16.614247, 49.209592], roomCode: 'Q01', venueKind: 'campus', category: 'quiz' },
  { id: 'ev-2', title: 'Tram Party', url: 'https://www.instagram.com/esnmendelubrno/',
    date: '2026-07-17', endDate: null, time: '20:00', location: 'Česká (sraz)', imageUrl: null,
    organizerKey: 'mendelu', societyId: 'esn', coord: null, roomCode: null,
    venueKind: 'offcampus', category: 'party' },
];

const fc = (id: number, floorId: number): RoomsCollection => ({ type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[16.6, 49.2]]] },
    properties: { id: 1, buildingId: id, floorId, floorLevel: 0, name: 'Q01', type: 't',
      category: 'teaching', label: 'l', passportNumber: null, seats: null,
      hasProjector: false, hasWhiteboard: false, code: null } }] });

beforeEach(() => {
  useAppStore.setState({ activeBuildingId: null, activeFloorId: null, mapSelection: null,
    roomsByBuilding: {}, mapLoadingBuilding: null, mapSearchQuery: '', mapSearchResults: [], mapFocusRequest: 0,
    mapEvents: [], mapEventsLoaded: false, mapPanelTab: 'places', eventFilter: 'all' });
  vi.mocked(fetchBuildingRooms).mockReset();
  vi.mocked(fetchMapEvents).mockReset();
  vi.mocked(fetchMapEvents).mockResolvedValue(MOCK_EVENTS);
});

describe('mapSlice', () => {
  it('setMapBuilding(0) selects Q and its default floor (truthiness gotcha)', () => {
    useAppStore.getState().setMapBuilding(0);
    expect(useAppStore.getState().activeBuildingId).toBe(0);
    expect(useAppStore.getState().activeFloorId).not.toBeNull(); // Q.defaultFloorId
  });

  it('exitToCampus clears building + selection', () => {
    useAppStore.getState().setMapBuilding(54678);
    useAppStore.getState().exitToCampus();
    expect(useAppStore.getState().activeBuildingId).toBeNull();
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('clearMapSelection drops the selection but keeps the camera (building/floor) untouched', () => {
    useAppStore.setState({ activeBuildingId: null, activeFloorId: null, mapSelection: { kind: 'poi', poi: { id: 1, name: 'x', type: '', url: null, phone: null, email: null }, coord: [16.6, 49.2] } });
    useAppStore.getState().clearMapSelection();
    expect(useAppStore.getState().mapSelection).toBeNull();
    expect(useAppStore.getState().activeBuildingId).toBeNull();
  });

  it('loadMapBuilding caches geometry from the api', async () => {
    vi.mocked(fetchBuildingRooms).mockResolvedValue(fc(54678, 7));
    await useAppStore.getState().loadMapBuilding(54678);
    expect(useAppStore.getState().roomsByBuilding[54678]?.features).toHaveLength(1);
  });

  it('focusRoomByCode resolves the index, sets building/floor/selection, and bumps the focus request', () => {
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusRoomByCode('Q01'); // exists in bundled index (building 0)
    const s = useAppStore.getState();
    expect(s.activeBuildingId).toBe(0);
    expect(s.mapSelection?.kind).toBe('roomRef');
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('focusCampus returns to overview and bumps the focus request', () => {
    useAppStore.getState().setMapBuilding(54678);
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusCampus();
    const s = useAppStore.getState();
    expect(s.activeBuildingId).toBeNull();
    expect(s.activeFloorId).toBeNull();
    expect(s.mapSelection).toBeNull();
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('focusPoint sets a named poi selection at the coord and bumps the focus request', () => {
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusPoint('Koleje JAK', [16.62, 49.22]);
    const s = useAppStore.getState();
    expect(s.activeBuildingId).toBeNull();
    expect(s.activeFloorId).toBeNull();
    expect(s.mapSelection).toMatchObject({ kind: 'poi', poi: { name: 'Koleje JAK' }, coord: [16.62, 49.22] });
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('setMapSearchQuery populates results', () => {
    useAppStore.getState().setMapSearchQuery('Q01');
    expect(useAppStore.getState().mapSearchResults.length).toBeGreaterThan(0);
  });

  it('setMapPanelTab and setEventFilter update state', () => {
    useAppStore.getState().setMapPanelTab('events');
    useAppStore.getState().setEventFilter('esn');
    expect(useAppStore.getState().mapPanelTab).toBe('events');
    expect(useAppStore.getState().eventFilter).toBe('esn');
  });

  it('loadMapEvents populates events once', async () => {
    await useAppStore.getState().loadMapEvents();
    expect(useAppStore.getState().mapEventsLoaded).toBe(true);
    expect(useAppStore.getState().mapEvents.length).toBeGreaterThan(0);
  });

  it('focusEventById from a PIN click (no opts) selects without moving the camera', async () => {
    await useAppStore.getState().loadMapEvents();
    const pinned = useAppStore.getState().mapEvents.find((e) => e.coord)!;
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById(pinned.id);
    const s = useAppStore.getState();
    expect(s.mapSelection).toMatchObject({ kind: 'event', event: { id: pinned.id } });
    expect(s.mapFocusRequest).toBe(before); // pin click never bumps — you're already on the pin
  });

  it('focusEventById off-campus also selects without moving the camera', async () => {
    await useAppStore.getState().loadMapEvents();
    const off = { ...useAppStore.getState().mapEvents[0], id: 'off-1', coord: null };
    useAppStore.setState({ mapEvents: [...useAppStore.getState().mapEvents, off] });
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById('off-1');
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind).toBe('event');
    expect(s.mapFocusRequest).toBe(before);
  });

  it('focusEventById from a LIST click ({ fly: true }) flies to an on-campus event', async () => {
    await useAppStore.getState().loadMapEvents();
    const pinned = useAppStore.getState().mapEvents.find((e) => e.coord)!;
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById(pinned.id, { fly: true });
    const s = useAppStore.getState();
    expect(s.mapSelection).toMatchObject({ kind: 'event', event: { id: pinned.id } });
    expect(s.mapFocusRequest).toBe(before + 1); // list click flies → bumps focus
  });

  it('focusEventById from a LIST click does NOT fly for an off-campus event (no coord)', async () => {
    await useAppStore.getState().loadMapEvents();
    const off = { ...useAppStore.getState().mapEvents[0], id: 'off-2', coord: null };
    useAppStore.setState({ mapEvents: [...useAppStore.getState().mapEvents, off] });
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById('off-2', { fly: true });
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind).toBe('event');
    expect(s.mapFocusRequest).toBe(before); // no coordinate → nothing to fly to
  });
});
