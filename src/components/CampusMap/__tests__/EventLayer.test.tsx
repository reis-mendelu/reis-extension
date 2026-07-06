import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Return a STABLE array ref each render (mirrors the real useState-backed hook);
// a fresh ref per render would re-memoize `groups` every render and loop.
vi.mock('../../../hooks/useEventsFacultySettings', () => {
  const subscribedFaculties = ['mendelu', 'pef'];
  return { useEventsFacultySettings: () => ({ subscribedFaculties, isLoading: false }) };
});
import { render, act } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handlers: Record<string, (...a: any[]) => void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeMap: any;
let paneEl: HTMLElement;

beforeEach(() => {
  handlers = {};
  paneEl = document.createElement('div');
  fakeMap = {
    createdPane: false,
    getPane: () => undefined,
    createPane() {
      this.createdPane = true;
      return paneEl;
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
    mapEvents: MOCK_MAP_EVENTS,
    eventFilter: 'all',
    activeBuildingId: null,
    mapSelection: null,
    language: 'en',
    mapMode: 'student',
    societyMapEvents: [],
    composerOpen: false,
    draftCoord: null,
    adminAssociationId: null,
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
    expect(fakeMap.createdPane).toBe(true);
    const btn = paneEl.querySelector('button') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.style.transform).toContain('10px'); // resting layer point (10,20)
    // Pins ride the zoom animation like native markers (no hiding).
    expect(handlers.zoomanim).toBeTruthy();
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

  it('renders the society events when in society mode', () => {
    useAppStore.setState({
      mapMode: 'society',
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
      eventFilter: 'all',
      activeBuildingId: null,
    });
    render(<EventLayer />);
    const btn = paneEl.querySelector('button[title="Society Party"]') as HTMLElement;
    expect(btn).toBeTruthy();
  });

  it('renders a draft pin at draftCoord while the composer is open (no saved events needed)', () => {
    useAppStore.setState({
      mapMode: 'society',
      adminAssociationId: 'supef',
      societyMapEvents: [],
      mapEvents: [],
      eventFilter: 'all',
      activeBuildingId: null,
      composerOpen: true,
      draftCoord: [16.61, 49.21],
    });
    render(<EventLayer />);
    const draft = paneEl.querySelector('[data-draft-pin="true"]') as HTMLElement;
    expect(draft).toBeTruthy();
    expect(draft.style.transform).toContain('10px'); // resting layer point (10,20)
  });

  it('does not render a draft pin when the composer is closed', () => {
    useAppStore.setState({
      mapMode: 'society',
      adminAssociationId: 'supef',
      societyMapEvents: [],
      mapEvents: [],
      eventFilter: 'all',
      activeBuildingId: null,
      composerOpen: false,
      draftCoord: [16.61, 49.21],
    });
    render(<EventLayer />);
    expect(paneEl.querySelector('[data-draft-pin="true"]')).toBeNull();
  });

  it('marks a mixed venue group scheduled if ANY event is scheduled (society mode)', () => {
    // Two events sharing the same coord (same venue group): one this-week (live),
    // one 30+ days out (scheduled). sortByDate puts the live one first, so the old
    // `events[0]` code would miss the scheduled flag entirely.
    useAppStore.setState({
      mapMode: 'society',
      societyMapEvents: [
        {
          id: 's-live',
          title: 'Live Now',
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
        {
          id: 's-future',
          title: 'Far Future',
          url: '',
          date: '2026-09-15',
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
      eventFilter: 'all',
      activeBuildingId: null,
    });
    render(<EventLayer />);
    expect(paneEl.querySelector('[data-scheduled="true"]')).toBeTruthy();
  });
});
