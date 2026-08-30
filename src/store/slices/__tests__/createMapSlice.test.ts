import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));
vi.mock('../../../api/mapEvents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/mapEvents')>();
  return { ...actual, fetchMapEvents: vi.fn() };
});
import { fetchBuildingRooms } from '../../../api/campusMap';
import { fetchMapEvents } from '../../../api/mapEvents';
import { useAppStore } from '../../useAppStore';
import type { RoomsCollection } from '../../../types/campusMap';
import type { MapEvent } from '../../../types/events';

// Fixture standing in for the real Supabase-backed fetchMapEvents (Task 13) —
// one on-campus event (has a coord, so it's pin-able) and one off-campus
// event (no coord), matching the variety the store-level tests exercise.
const MOCK_EVENTS: MapEvent[] = [
  {
    id: 'ev-1',
    title: 'PEF Kvíz',
    url: '',
    date: '2026-07-10',
    endDate: null,
    time: '18:00',
    location: null,
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord: [16.614247, 49.209592],
    roomCode: 'Q01',
    venueKind: 'campus',
    category: 'quiz',
  },
  {
    id: 'ev-2',
    title: 'Tram Party',
    url: 'https://www.instagram.com/esnmendelubrno/',
    date: '2026-07-17',
    endDate: null,
    time: '20:00',
    location: 'Česká (sraz)',
    imageUrl: null,
    organizerKey: 'mendelu',
    societyId: 'esn',
    coord: null,
    roomCode: null,
    venueKind: 'offcampus',
    category: 'party',
  },
];

const fc = (id: number, floorId: number): RoomsCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[16.6, 49.2]]] },
      properties: {
        id: 1,
        buildingId: id,
        floorId,
        floorLevel: 0,
        name: 'Q01',
        type: 't',
        category: 'teaching',
        label: 'l',
        passportNumber: null,
        seats: null,
        hasProjector: false,
        hasWhiteboard: false,
        code: null,
      },
    },
  ],
});

beforeEach(() => {
  useAppStore.setState({
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
    placingEvent: false,
    draftCoord: null,
  });
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
    useAppStore.setState({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: {
        kind: 'poi',
        poi: { id: 1, name: 'x', type: '', url: null, phone: null, email: null },
        coord: [16.6, 49.2],
      },
    });
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
    expect(s.mapSelection).toMatchObject({
      kind: 'poi',
      poi: { name: 'Koleje JAK' },
      coord: [16.62, 49.22],
    });
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('focusRemotePlaceById flies to the site: poi selection at the outline centroid, address as type, bumps focus', () => {
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusRemotePlaceById(-102); // Zahradnická fakulta – Lednice
    const s = useAppStore.getState();
    expect(s.activeBuildingId).toBeNull();
    expect(s.activeFloorId).toBeNull();
    expect(s.mapSelection).toMatchObject({
      kind: 'poi',
      poi: {
        id: -102,
        name: 'Zahradnická fakulta – Lednice',
        type: 'Valtická 337, Lednice',
        url: 'https://zf.mendelu.cz/',
      },
    });
    // Coord is the footprint centroid, near Lednice (lon ~16.80, lat ~48.80).
    const coord = (s.mapSelection as { coord: [number, number] }).coord;
    expect(coord[0]).toBeGreaterThan(16.79);
    expect(coord[0]).toBeLessThan(16.81);
    expect(coord[1]).toBeGreaterThan(48.79);
    expect(coord[1]).toBeLessThan(48.81);
    expect(s.mapFocusRequest).toBe(before + 1);
  });

  it('focusRemotePlaceById with an unknown id leaves state untouched', () => {
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusRemotePlaceById(-999);
    const s = useAppStore.getState();
    expect(s.mapSelection).toBeNull();
    expect(s.mapFocusRequest).toBe(before);
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

  it('loadMapEvents is a no-op once already loaded (does not refetch)', async () => {
    useAppStore.setState({ mapEventsLoaded: true, mapEvents: [] });
    await useAppStore.getState().loadMapEvents();
    expect(vi.mocked(fetchMapEvents)).not.toHaveBeenCalled();
    expect(useAppStore.getState().mapEvents).toEqual([]);
  });

  it('reloadMapEvents refetches the public feed even when already loaded (post-publish freshness)', async () => {
    // Simulate a live session that booted with an empty public feed, then a
    // society published an event: the load-once guard must NOT block a refresh.
    useAppStore.setState({ mapEventsLoaded: true, mapEvents: [] });
    await useAppStore.getState().reloadMapEvents();
    expect(vi.mocked(fetchMapEvents)).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().mapEvents.length).toBe(MOCK_EVENTS.length);
    expect(useAppStore.getState().mapEventsLoaded).toBe(true);
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
    // safe: loadMapEvents populates mapEvents (asserted non-empty elsewhere)
    const off = { ...useAppStore.getState().mapEvents[0]!, id: 'off-1', coord: null };
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
    // safe: loadMapEvents populates mapEvents (asserted non-empty elsewhere)
    const off = { ...useAppStore.getState().mapEvents[0]!, id: 'off-2', coord: null };
    useAppStore.setState({ mapEvents: [...useAppStore.getState().mapEvents, off] });
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusEventById('off-2', { fly: true });
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind).toBe('event');
    expect(s.mapFocusRequest).toBe(before); // no coordinate → nothing to fly to
  });
});

describe('society events', () => {
  it('starts with no society events', () => {
    expect(useAppStore.getState().societyMapEvents).toEqual([]);
  });

  it('refreshSocietyMapEvents maps societyPosts to located MapEvents', () => {
    useAppStore.setState({
      societyPosts: [
        {
          id: 'e1',
          association_id: 'supef',
          title: 'Party',
          body: null,
          category: 'party',
          date: '2026-07-10',
          end_date: null,
          time: '20:00',
          venue_kind: 'offcampus',
          room_code: null,
          coord_lng: 16.61,
          coord_lat: 49.21,
          location: 'Bar',
          url: null,
          created_by: null,
          visible_from: null,
        },
      ],
    });
    useAppStore.getState().refreshSocietyMapEvents();
    const evs = useAppStore.getState().societyMapEvents;
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ id: 'e1', title: 'Party', coord: [16.61, 49.21] });
  });
});

describe('focusEventById resolves against the active pool', () => {
  it('admin console: resolves a scheduled/past event from societyMapEvents (not mapEvents)', () => {
    const scheduled: MapEvent = {
      id: 'sch1',
      title: 'Future Society Event',
      url: '',
      date: '2027-01-01',
      endDate: null,
      time: '18:00',
      location: null,
      imageUrl: null,
      organizerKey: 'pef',
      societyId: 'supef',
      coord: [16.614247, 49.209592],
      roomCode: 'Q01',
      venueKind: 'campus',
      category: 'quiz',
    };
    useAppStore.setState({
      adminConsoleOpen: true,
      societyMapEvents: [scheduled],
      mapEvents: [],
    });
    useAppStore.getState().focusEventById('sch1');
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind).toBe('event');
    expect((s.mapSelection as { event: MapEvent }).event.id).toBe('sch1');
  });

  it('student app: resolves from mapEvents (not societyMapEvents)', () => {
    const pub: MapEvent = {
      id: 'pub1',
      title: 'Public Event',
      url: '',
      date: '2026-08-01',
      endDate: null,
      time: '18:00',
      location: null,
      imageUrl: null,
      organizerKey: 'mendelu',
      societyId: 'esn',
      coord: [16.614247, 49.209592],
      roomCode: 'Q01',
      venueKind: 'campus',
      category: 'quiz',
    };
    useAppStore.setState({ adminConsoleOpen: false, mapEvents: [pub], societyMapEvents: [] });
    useAppStore.getState().focusEventById('pub1');
    const s = useAppStore.getState();
    expect(s.mapSelection?.kind).toBe('event');
    expect((s.mapSelection as { event: MapEvent }).event.id).toBe('pub1');
  });
});

describe('click-to-place', () => {
  it('arms and captures a coordinate', () => {
    const s = useAppStore.getState();
    s.beginPlacing();
    expect(useAppStore.getState().placingEvent).toBe(true);
    useAppStore.getState().placeDraftCoord([16.6, 49.2]);
    const st = useAppStore.getState();
    expect(st.placingEvent).toBe(false);
    expect(st.draftCoord).toEqual([16.6, 49.2]);
  });
  it('cancel clears the armed state without a coordinate', () => {
    useAppStore.getState().beginPlacing();
    useAppStore.getState().cancelPlacing();
    expect(useAppStore.getState().placingEvent).toBe(false);
    expect(useAppStore.getState().draftCoord).toBeNull();
  });

  it('beginPlacing returns to the campus overview so floor drill-in cannot swallow the click', () => {
    useAppStore.setState({
      activeBuildingId: 123,
      activeFloorId: 5,
      mapFocusRequest: 0,
      placingEvent: false,
    });
    useAppStore.getState().beginPlacing();
    const s = useAppStore.getState();
    expect(s.placingEvent).toBe(true);
    expect(s.activeBuildingId).toBeNull();
    expect(s.mapFocusRequest).toBe(1);
  });
});

describe('composer open/close', () => {
  it('openComposer sets composerOpen true; closeComposer resets composerOpen, placingEvent, draftCoord', () => {
    const s = useAppStore.getState();
    s.openComposer();
    expect(useAppStore.getState().composerOpen).toBe(true);
    // Arm placement AND seed a draft coord so we can prove closeComposer resets BOTH.
    useAppStore.setState({ draftCoord: [16.6, 49.2] });
    s.beginPlacing(); // placingEvent -> true, draftCoord untouched
    expect(useAppStore.getState().placingEvent).toBe(true);
    s.closeComposer();
    const st = useAppStore.getState();
    expect(st.composerOpen).toBe(false);
    expect(st.placingEvent).toBe(false); // genuinely reset by closeComposer
    expect(st.draftCoord).toBeNull(); // genuinely reset by closeComposer
  });
});

/**
 * Sprint 08: the camera move for "Ukázat na mapě".
 *
 * It first lived in its own hook that called setView on the Leaflet instance
 * directly, and lost a race nobody would guess from reading it: MapCanvas's
 * draw effect ends by fitting the whole campus on mount, and that effect runs
 * AFTER the setMapInstance subscriber that fired the setView. The pin appeared
 * and the camera sat on the campus overview. So the request goes through
 * `mapFocusRequest`, the counter MapCanvas's own camera already consumes —
 * one owner of the camera instead of two racing.
 */
describe('previewDraftOnMap', () => {
  beforeEach(() => {
    useAppStore.setState({
      draftFocusRequest: 0,
      mapFocusRequest: 0,
      draftCoord: [16.6142, 49.2096],
      mapSelection: null,
      activeBuildingId: null,
      activeFloorId: null,
    });
  });

  it('asks the map camera to move, through the counter MapCanvas consumes', () => {
    useAppStore.getState().previewDraftOnMap();
    const st = useAppStore.getState();
    expect(st.mapFocusRequest).toBe(1);
    expect(st.draftFocusRequest).toBe(1);
  });

  // Pins are only drawn in the campus overview, so flying to a draft from
  // inside a building would land on a floor plan with no pin on it.
  it('leaves floor view so the draft pin is actually visible', () => {
    useAppStore.setState({ activeBuildingId: 3, activeFloorId: 1 });
    useAppStore.getState().previewDraftOnMap();
    const st = useAppStore.getState();
    expect(st.activeBuildingId).toBeNull();
    expect(st.activeFloorId).toBeNull();
  });

  // A live selection would send MapCanvas's camera chain down the poi/event
  // branch instead of the draft one.
  it('clears any selection that would claim the camera first', () => {
    useAppStore.setState({
      mapSelection: { kind: 'poi', poi: { id: 'x', name: 'X' }, coord: [16.6, 49.2] } as never,
    });
    useAppStore.getState().previewDraftOnMap();
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('is repeatable, so a second press moves the camera again', () => {
    useAppStore.getState().previewDraftOnMap();
    useAppStore.getState().previewDraftOnMap();
    expect(useAppStore.getState().mapFocusRequest).toBe(2);
  });
});

/**
 * The camera has to know WHICH target a focus request meant, not merely that
 * one happened.
 *
 * The first attempt tracked "have I flown for this request yet" in a ref inside
 * MapCanvas's draw effect. That effect runs more than once per request — React
 * re-invokes it in dev, and `roomsByBuilding` legitimately lands after mount —
 * so run 1 flew to the draft and consumed the flag and run 2 fell through and
 * re-fitted the campus on top of it. Observed on a real map: the camera arrived
 * at the draft and was thrown back to the overview within a frame.
 *
 * So the target is stated rather than consumed: every focus request says where
 * it is pointing, and re-running the effect re-applies the same answer.
 */
describe('mapFocusTarget', () => {
  beforeEach(() => {
    useAppStore.setState({
      mapFocusRequest: 0,
      draftFocusRequest: 0,
      mapFocusTarget: 'campus',
      draftCoord: [16.6142, 49.2096],
      mapSelection: null,
      activeBuildingId: null,
      activeFloorId: null,
    });
  });

  it('starts pointing at the campus', () => {
    expect(useAppStore.getState().mapFocusTarget).toBe('campus');
  });

  it('points at the draft when a preview is asked for', () => {
    useAppStore.getState().previewDraftOnMap();
    expect(useAppStore.getState().mapFocusTarget).toBe('draft');
  });

  // Re-reading it must give the same answer, however many times the draw effect
  // runs — that is the whole point of stating it instead of consuming it.
  it('keeps pointing at the draft until something else claims the camera', () => {
    useAppStore.getState().previewDraftOnMap();
    expect(useAppStore.getState().mapFocusTarget).toBe('draft');
    expect(useAppStore.getState().mapFocusTarget).toBe('draft');
  });

  it('goes back to the campus when the whole campus is asked for', () => {
    useAppStore.getState().previewDraftOnMap();
    useAppStore.getState().focusCampus();
    expect(useAppStore.getState().mapFocusTarget).toBe('campus');
  });

  it('goes back to the campus when a room is focused instead', () => {
    useAppStore.getState().previewDraftOnMap();
    useAppStore.getState().focusPoint('Menza', [16.61, 49.21]);
    expect(useAppStore.getState().mapFocusTarget).toBe('campus');
  });

  // Closing the composer removes the draft entirely, so nothing is left to
  // point at.
  it('stops pointing at a draft that no longer exists', () => {
    useAppStore.getState().previewDraftOnMap();
    useAppStore.getState().closeComposer();
    expect(useAppStore.getState().draftCoord).toBeNull();
    expect(useAppStore.getState().mapFocusTarget).toBe('campus');
  });
});
