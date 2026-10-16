import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { EVENTS_PANE } from '../mapPanes';

// Opening a building used to unmount the whole pin layer, so an event in Q02
// vanished the moment a student walked into PEF. These pin the new rule: while
// a building is open, the events whose room is IN it stay, at their room;
// events elsewhere stay hidden.
import {
  Q,
  Q02_FLOOR,
  Q_OTHER_FLOOR,
  BUILDING_CENTRE,
  room,
  Q_ROOMS,
  inDays,
  event,
} from './fixtures/inBuildingFixtures';

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

  it('still hides an event that is not soon', () => {
    useAppStore.setState({
      mapEvents: [{ ...event('q02-party', 'Q02', BUILDING_CENTRE), date: inDays(40) }],
    });
    render(<EventLayer />);
    expect(pins()).toHaveLength(0);
  });

  it('pins a far event while it is selected in the floor view, and only then', () => {
    const far = { ...event('q02-party', 'Q02', BUILDING_CENTRE), date: inDays(40) };
    useAppStore.setState({ mapEvents: [far] });
    render(<EventLayer />);
    expect(pins()).toHaveLength(0);
    act(() => {
      useAppStore.setState({ mapSelection: { kind: 'event', event: far } });
    });
    expect(pins()).toHaveLength(1);
    act(() => {
      useAppStore.setState({ mapSelection: null });
    });
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
