import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { EVENTS_PANE } from '../mapPanes';
import type { MapEvent } from '../../../types/events';
import type { RoomFeature, RoomsCollection } from '../../../types/campusMap';

// Opening a building used to unmount the whole pin layer, so an event in Q02
// vanished the moment a student walked into PEF. These pin the new rule: while
// a building is open, the events whose room is IN it stay, at their room;
// events elsewhere stay hidden.

// Q (buildings.json id 0): Q02 is floor 5 (ground, level 0), placeId 599.
const Q = 0;
const Q02_FLOOR = 5;
const Q_OTHER_FLOOR = 4;
// Its building centre, which is where locateEvent puts a Q02 event's coord.
const BUILDING_CENTRE: [number, number] = [16.6142, 49.2096];
// Where the room itself is drawn: deliberately NOT the building centre.
const ROOM_RING = [
  [16.615, 49.21],
  [16.6152, 49.21],
  [16.6152, 49.2102],
  [16.615, 49.2102],
];

function room(id: number, floorId: number, floorLevel: number): RoomFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ROOM_RING] },
    properties: {
      id,
      buildingId: Q,
      floorId,
      floorLevel,
      name: 'Q02',
      type: 'lecture',
      category: 'classroom',
      label: 'Q02',
      passportNumber: 'BA39N1010',
      seats: null,
      hasProjector: false,
      hasWhiteboard: false,
      code: null,
    },
  } as unknown as RoomFeature;
}
const Q_ROOMS: RoomsCollection = { type: 'FeatureCollection', features: [room(599, 5, 0)] };

function inTwoDays(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

function inDays(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function event(id: string, roomCode: string, coord: [number, number]): MapEvent {
  return {
    id,
    title: id,
    url: '',
    date: inTwoDays(),
    endDate: null,
    time: '18:00',
    location: roomCode,
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord,
    roomCode,
    venueKind: 'campus',
    category: 'party',
  };
}

let paneEl: HTMLElement;
const pins = () => Array.from(paneEl.querySelectorAll('button'));

beforeEach(() => {
  paneEl = document.createElement('div');
  const panes = new Map<string, HTMLElement>();
  setMapInstance({
    getPane: (n: string) => panes.get(n),
    createPane: (n: string) => {
      const el = n === EVENTS_PANE ? paneEl : document.createElement('div');
      panes.set(n, el);
      return el;
    },
    getZoom: () => 20,
    // [lat, lng] → x = lng, y = lat, so a test reads WHERE a pin was put.
    latLngToLayerPoint: (ll: [number, number]) => ({ x: ll[1], y: ll[0] }),
    _latLngToNewLayerPoint: () => ({ round: () => ({ x: 0, y: 0 }) }),
    on: () => {},
    off: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  useAppStore.setState({
    mapEvents: [
      event('q02-party', 'Q02', BUILDING_CENTRE),
      // Building A (A01 is its friendly name): another building's event.
      event('a01-party', 'A01', [16.5, 49.2]),
    ],
    activeBuildingId: Q,
    activeFloorId: Q02_FLOOR,
    roomsByBuilding: { [Q]: Q_ROOMS },
    mapSelection: null,
    adminConsoleOpen: false,
    societyMapEvents: [],
    composerOpen: false,
    draftCoord: null,
    now: new Date(),
  });
});

afterEach(() => setMapInstance(null));

describe('EventLayer with a building open', () => {
  it('keeps the Q02 event pinned, at the room rather than the building centre', () => {
    render(<EventLayer />);
    const pin = paneEl.querySelector('button[title="q02-party"]') as HTMLElement;
    expect(pin).toBeTruthy();
    // The ring's centre, not the building's 16.6142 / 49.2096.
    const [x, y] = (pin.style.transform.match(/-?[\d.]+(?=px)/g) ?? []).map(Number);
    expect(x).toBeCloseTo(16.6151, 4);
    expect(y).toBeCloseTo(49.2101, 4);
    expect(pin.getAttribute('data-other-floor')).toBeNull();
  });

  it('hides events whose room is in another building', () => {
    render(<EventLayer />);
    expect(paneEl.querySelector('button[title="a01-party"]')).toBeNull();
    expect(pins()).toHaveLength(1);
  });

  it('selects the event when its pin is tapped, and stays in the floor view', () => {
    useAppStore.setState({ mapFocusRequest: 7 });
    render(<EventLayer />);
    fireEvent.click(paneEl.querySelector('button[title="q02-party"]') as HTMLElement);
    const st = useAppStore.getState();
    expect(st.mapSelection?.kind === 'event' && st.mapSelection.event.id).toBe('q02-party');
    // Leaving would re-run the canvas draw and zoom the camera out to the event.
    expect(st.activeBuildingId).toBe(Q);
    expect(st.activeFloorId).toBe(Q02_FLOOR);
    expect(st.mapFocusRequest).toBe(7);
  });

  it('still leaves the building when a list click selects the event with fly', () => {
    render(<EventLayer />);
    act(() => useAppStore.getState().focusEventById('q02-party', { fly: true }));
    expect(useAppStore.getState().activeBuildingId).toBeNull();
  });

  it('still shows it, marked, when the floor view is a different floor from its room', () => {
    useAppStore.setState({ activeFloorId: Q_OTHER_FLOOR });
    render(<EventLayer />);
    const pin = paneEl.querySelector('button[title^="q02-party"]') as HTMLElement;
    expect(pin).toBeTruthy();
    expect(pin.getAttribute('data-other-floor')).toBe('true');
  });

  it('words the other-floor pin: title and badge name the floor, dimmed pin is not a bare numeral', () => {
    useAppStore.setState({ activeFloorId: Q_OTHER_FLOOR });
    render(<EventLayer />);
    const pin = paneEl.querySelector('button[title^="q02-party"]') as HTMLElement;
    expect(pin.getAttribute('title')).toMatch(/q02-party · .+/);
    expect(pin.getAttribute('aria-label')).toBe(pin.getAttribute('title'));
  });

  it('paints a pin for another floor underneath one on the shown floor when they share a spot', () => {
    // Two rooms stacked on the same x/y: the first pin in the DOM is painted
    // first, so the on-floor one must come last or it is covered and untappable.
    const upstairs = room(405, Q_OTHER_FLOOR, 1); // Q2.43, floor 4 in the real index
    useAppStore.setState({
      activeFloorId: Q02_FLOOR,
      roomsByBuilding: { [Q]: { ...Q_ROOMS, features: [upstairs, ...Q_ROOMS.features] } },
      // Earliest date first would otherwise draw the upstairs event first AND last.
      mapEvents: [
        { ...event('q02-party', 'Q02', BUILDING_CENTRE), date: inDays(3) },
        { ...event('q2-up', 'Q2.43', BUILDING_CENTRE), date: inDays(1) },
      ],
    });
    render(<EventLayer />);
    const order = pins().map((b) => b.getAttribute('title'));
    expect(order[order.length - 1]).toBe('q02-party');
  });

  it('falls back to the event coordinate when the plan is loaded but lacks the room', () => {
    useAppStore.setState({ roomsByBuilding: { [Q]: { ...Q_ROOMS, features: [] } } });
    render(<EventLayer />);
    expect(paneEl.querySelector('button[title="q02-party"]')).toBeTruthy();
  });

  it('puts a hand-placed event with a room at the room, not at its own coord', () => {
    useAppStore.setState({ mapEvents: [event('q02-party', 'Q02', [16.7, 49.3])] });
    render(<EventLayer />);
    const pin = paneEl.querySelector('button[title="q02-party"]') as HTMLElement;
    expect(pin.style.transform).not.toContain('16.7px');
  });

  it('still hides an event that is not soon, and still pins the selected far one', () => {
    useAppStore.setState({
      mapEvents: [{ ...event('q02-party', 'Q02', BUILDING_CENTRE), date: inDays(40) }],
    });
    render(<EventLayer />);
    expect(pins()).toHaveLength(0);
  });

  it('shows the society event at its room while authoring in the console', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      societyMapEvents: [event('own', 'Q02', BUILDING_CENTRE)],
      mapEvents: [],
    });
    render(<EventLayer />);
    expect(paneEl.querySelector('button[title="own"]')).toBeTruthy();
  });

  it('falls back to the event coordinate while the floor plan is still loading', () => {
    useAppStore.setState({ roomsByBuilding: {} });
    render(<EventLayer />);
    const pin = paneEl.querySelector('button[title="q02-party"]') as HTMLElement;
    expect(pin).toBeTruthy();
    expect(pin.style.transform).toContain('16.6142px');
  });

  it('draws the campus overview exactly as before once the building is closed', () => {
    useAppStore.setState({ activeBuildingId: null, activeFloorId: null });
    render(<EventLayer />);
    expect(pins()).toHaveLength(2);
    const pin = paneEl.querySelector('button[title="q02-party"]') as HTMLElement;
    expect(pin.style.transform).toContain('16.6142px');
  });
});
