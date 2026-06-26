import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));
import { fetchBuildingRooms } from '../../../api/campusMap';
import { useAppStore } from '../../useAppStore';
import type { RoomsCollection } from '../../../types/campusMap';

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
    useAppStore.getState().setEventFilter('faculty');
    expect(useAppStore.getState().mapPanelTab).toBe('events');
    expect(useAppStore.getState().eventFilter).toBe('faculty');
  });

  it('loadMapEvents populates events once', async () => {
    await useAppStore.getState().loadMapEvents();
    expect(useAppStore.getState().mapEventsLoaded).toBe(true);
    expect(useAppStore.getState().mapEvents.length).toBeGreaterThan(0);
  });

  it('focusEventById with a coord selects the event and bumps the focus request', async () => {
    await useAppStore.getState().loadMapEvents();
    const pinned = useAppStore.getState().mapEvents.find((e) => e.coord)!;
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById(pinned.id);
    const s = useAppStore.getState();
    expect(s.mapSelection).toMatchObject({ kind: 'event', event: { id: pinned.id } });
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('focusEventById off-campus selects but does not move the camera', async () => {
    await useAppStore.getState().loadMapEvents();
    const off = useAppStore.getState().mapEvents.find((e) => !e.coord)!;
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById(off.id);
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind).toBe('event');
    expect(s.mapFocusRequest).toBe(before);
  });
});
