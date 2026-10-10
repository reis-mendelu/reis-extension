import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render, act, fireEvent } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';
import { EVENTS_PANE, LABELS_PANE, LEAFLET_PANE_Z, REIS_PANE_Z } from '../mapPanes';

/**
 * An ISO date `days` from today, so a test that needs an event on one side of
 * the public window says so instead of hard-coding a date that rots. The
 * mixed-venue test below used literal dates chosen in July 2026; by September
 * the "30+ days out" one had drifted inside the 14-day window and the test
 * failed on every PR regardless of its contents.
 */
function isoInDays(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handlers: Record<string, (...a: any[]) => void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeMap: any;
let paneEl: HTMLElement;
let panes: Map<string, HTMLElement>;

beforeEach(() => {
  handlers = {};
  paneEl = document.createElement('div');
  // Name-aware, like Leaflet's own: a mock that handed the same element back
  // for every name would let the pins and the labels share one pane and the
  // paint order under test would be unobservable.
  panes = new Map<string, HTMLElement>();
  fakeMap = {
    getPane(n: string) {
      return panes.get(n);
    },
    createPane(n: string) {
      const el = n === EVENTS_PANE ? paneEl : document.createElement('div');
      panes.set(n, el);
      return el;
    },
    // Current zoom — lets EventLayer tell a pure pan from a fly's zoom change.
    zoom: 17,
    getZoom() {
      return this.zoom;
    },
    // Resting layer point.
    latLngToLayerPoint() {
      return { x: this.zoom === 17 ? 10 : 50, y: 20 };
    },
    // Post-zoom target layer point (Leaflet rounds it).
    _latLngToNewLayerPoint: () => ({ round: () => ({ x: 99, y: 88 }) }),
    // Record the handler under every space-separated event token.
    on: (evts: string, fn: () => void) => {
      evts.split(' ').forEach((e) => {
        handlers[e] = fn;
      });
    },
    off: () => {},
  };
  useAppStore.setState({
    // Shifted onto "soon" dates (today+3): MOCK_MAP_EVENTS' own July 2026 dates
    // are now in the past, and the student map filters pins to isSoonEvent —
    // the pipeline tests below need at least one event to survive that filter.
    mapEvents: MOCK_MAP_EVENTS.map((e) => ({ ...e, date: isoInDays(3), endDate: null })),
    activeBuildingId: null,
    mapSelection: null,
    language: 'en',
    adminConsoleOpen: false,
    societyMapEvents: [],
    composerOpen: false,
    draftCoord: null,
    adminAssociationId: null,
    adminActiveAssociationId: null,
    // The store's clock is shared across tests; a test below moves it.
    now: new Date(),
  });
  setMapInstance(fakeMap);
});

afterEach(() => {
  setMapInstance(null);
});

describe('EventLayer', () => {
  it('renders pins inside a Leaflet pane positioned by layer point', () => {
    render(<EventLayer />);
    // A dedicated map pane is created and pins are portaled into it — being a
    // child of the map pane is what makes panning track for free (no JS).
    expect(panes.get(EVENTS_PANE)).toBe(paneEl);
    const btn = paneEl.querySelector('button') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.style.transform).toContain('10px'); // resting layer point (10,20)
    // Pins ride the zoom animation like native markers (no hiding).
    expect(handlers.zoomanim).toBeTruthy();
  });

  /**
   * The pane's z-index, which is the whole reason a pin's hover bubble is
   * readable. It used to be a bare `640` written here, one step BELOW Leaflet's
   * tooltip pane — and every lettered building name is a Leaflet tooltip, so
   * the letters drew straight through the bubble.
   */
  it('puts the pins above the map labels and below the user-invoked tooltips', () => {
    render(<EventLayer />);
    const z = Number(paneEl.style.zIndex);
    expect(z).toBe(REIS_PANE_Z[EVENTS_PANE]);
    expect(z).toBeGreaterThan(REIS_PANE_Z[LABELS_PANE]);
    expect(z).toBeLessThan(LEAFLET_PANE_Z.tooltip);
  });

  it('animates pins to the post-zoom layer point during a zoom (no hiding)', () => {
    render(<EventLayer />);
    act(() => {
      handlers.zoomanim({ zoom: 19, center: { lat: 49, lng: 16 } });
    });
    const btn = paneEl.querySelector('button') as HTMLElement;
    // Moved to the _latLngToNewLayerPoint target (99,88) so it glides with the map.
    expect(btn.style.transform).toContain('99px');
    expect(btn.style.transform).toContain('88px');
    // Pins are never hidden during zoom anymore.
    expect(paneEl.innerHTML).not.toContain('opacity-0');
  });

  it('re-projects pins on move only when the zoom changed (fly), not on a pure pan', () => {
    render(<EventLayer />);
    const btn = () => paneEl.querySelector('button') as HTMLElement;
    expect(btn().style.transform).toContain('10px'); // resting (zoom 17)
    // Pure pan: same zoom → pane rides the transform, no re-projection.
    act(() => {
      handlers.move();
    });
    expect(btn().style.transform).toContain('10px');
    // Fly: zoom changed mid-flight → re-project to the new layer point.
    act(() => {
      fakeMap.zoom = 18;
      handlers.move();
    });
    expect(btn().style.transform).toContain('50px');
  });

  // The pool swap this layer performs: the student map draws mapEvents, the
  // admin console's map draws the society's own. `adminConsoleOpen` is the
  // discriminator — it replaced the old `mapMode`, which no longer exists.
  it("draws the society's own events when the admin console is open", () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      societyMapEvents: [
        {
          id: 's1',
          title: 'Society Party',
          url: '',
          date: '2026-07-10',
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.61, 49.21],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
      mapEvents: [],
      activeBuildingId: null,
    });
    render(<EventLayer />);
    const btn = paneEl.querySelector('button[title="Society Party"]') as HTMLElement;
    expect(btn).toBeTruthy();
  });

  it('draws the authoring society\u2019s own events while the admin console is open', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      societyMapEvents: [
        {
          id: 's1',
          title: 'SUPEF Party',
          url: '',
          date: '2026-07-10',
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.61, 49.21],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
      mapEvents: [],
      activeBuildingId: null,
    });
    render(<EventLayer />);
    expect(paneEl.querySelector('button[title="SUPEF Party"]')).toBeTruthy();
  });

  it('renders a draft pin at draftCoord while the composer is open (no saved events needed)', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      societyMapEvents: [],
      mapEvents: [],
      activeBuildingId: null,
      composerOpen: true,
      draftCoord: [16.61, 49.21],
    });
    render(<EventLayer />);
    const draft = paneEl.querySelector('[data-draft-pin="true"]') as HTMLElement;
    expect(draft).toBeTruthy();
    expect(draft.style.transform).toContain('10px'); // resting layer point (10,20)
  });

  it('re-enters placing mode when the draft pin is clicked', () => {
    const beginPlacing = vi.fn();
    useAppStore.setState({
      adminConsoleOpen: true,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      societyMapEvents: [],
      mapEvents: [],
      activeBuildingId: null,
      composerOpen: true,
      draftCoord: [16.61, 49.21],
      beginPlacing,
    });
    render(<EventLayer />);
    const draft = paneEl.querySelector('[data-draft-pin="true"]') as HTMLElement;
    fireEvent.click(draft);
    expect(beginPlacing).toHaveBeenCalledOnce();
  });

  it('does not render a draft pin when the composer is closed', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      societyMapEvents: [],
      mapEvents: [],
      activeBuildingId: null,
      composerOpen: false,
      draftCoord: [16.61, 49.21],
    });
    render(<EventLayer />);
    expect(paneEl.querySelector('[data-draft-pin="true"]')).toBeNull();
  });

  // Students' pins show what is on SOON: the catalog list carries the whole
  // semester, and a semester of pins would bury the campus.
  it('pins only the soon event on the student map; the far one stays off the map', () => {
    useAppStore.setState({
      mapEvents: [
        {
          id: 'soon-1',
          title: 'Soon Event',
          url: '',
          date: isoInDays(3),
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.61, 49.21],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
        {
          id: 'far-1',
          title: 'Far Event',
          url: '',
          date: isoInDays(20),
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.7, 49.3],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
      activeBuildingId: null,
    });
    render(<EventLayer />);
    expect(paneEl.querySelectorAll('button').length).toBe(1);
    expect(paneEl.querySelector('button[title="Soon Event"]')).toBeTruthy();
    expect(paneEl.querySelector('button[title="Far Event"]')).toBeNull();
  });

  // The camera flies to a selected event wherever it came from — a "Později"
  // row, a calendar RSVP block — so a far event has to be pinned while it is
  // selected, or the fly lands on an empty map.
  it('pins a far event while it is selected, and only then', () => {
    const far = {
      id: 'far-1',
      title: 'Far Event',
      url: '',
      date: isoInDays(20),
      endDate: null,
      time: null,
      location: null,
      imageUrl: null,
      organizerKey: 'pef' as const,
      societyId: 'supef',
      coord: [16.7, 49.3] as [number, number],
      roomCode: null,
      venueKind: 'offcampus' as const,
      category: 'party' as const,
    };
    useAppStore.setState({ mapEvents: [far], mapSelection: null, activeBuildingId: null });
    render(<EventLayer />);
    expect(paneEl.querySelector('button[title="Far Event"]')).toBeNull();
    act(() => {
      useAppStore.setState({ mapSelection: { kind: 'event', event: far } });
    });
    expect(paneEl.querySelector('button[title="Far Event"]')).toBeTruthy();
    act(() => {
      useAppStore.setState({ mapSelection: null });
    });
    expect(paneEl.querySelector('button[title="Far Event"]')).toBeNull();
  });

  // A society authoring in the console still sees every one of its own
  // events — soon or not — so it can tell a far-future publish worked.
  it("draws every one of a society's own events while authoring, soon or not", () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      societyMapEvents: [
        {
          id: 's-soon',
          title: 'Soon Society Event',
          url: '',
          date: isoInDays(3),
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.61, 49.21],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
        {
          id: 's-far',
          title: 'Far Society Event',
          url: '',
          date: isoInDays(20),
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.7, 49.3],
          roomCode: null,
          venueKind: 'offcampus',
          category: 'party',
        },
      ],
      mapEvents: [],
      activeBuildingId: null,
    });
    render(<EventLayer />);
    expect(paneEl.querySelectorAll('button').length).toBe(2);
  });
  /**
   * A map left open across midnight. The soon filter used to be memoized on
   * the event list alone and read `new Date()` inside, so it froze at whatever
   * day the list last changed: yesterday's event kept its pin, and an event
   * that had just come inside the 14-day horizon stayed off the map. The
   * store's clock (advanced by the pulse) is what moves it now.
   */
  it('re-filters the pins when the store clock crosses midnight', () => {
    const at = (id: string, title: string, date: string) => ({
      id,
      title,
      url: '',
      date,
      endDate: null,
      time: null,
      location: null,
      imageUrl: null,
      organizerKey: 'pef' as const,
      societyId: 'supef',
      coord: [16.61, 49.21] as [number, number],
      roomCode: null,
      venueKind: 'offcampus' as const,
      category: 'party' as const,
    });
    useAppStore.setState({
      now: new Date(2026, 9, 9, 23, 59),
      mapEvents: [
        at('today', 'Tonight', '2026-10-09'),
        // Day 14 from 9 October: just outside the horizon, inside it tomorrow.
        at('edge', 'Edge', '2026-10-23'),
      ],
    });
    render(<EventLayer />);
    expect(paneEl.querySelector('button[title="Tonight"]')).toBeTruthy();
    expect(paneEl.querySelector('button[title="Edge"]')).toBeNull();
    act(() => {
      useAppStore.setState({ now: new Date(2026, 9, 10, 0, 1) });
    });
    expect(paneEl.querySelector('button[title="Tonight"]')).toBeNull();
    expect(paneEl.querySelector('button[title="Edge"]')).toBeTruthy();
  });
});
