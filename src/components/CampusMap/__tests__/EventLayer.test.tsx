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
import { MOCK_MAP_EVENTS } from '../../../api/mapEvents';

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
    createPane() { this.createdPane = true; return paneEl; },
    // Pins are positioned by LAYER point now (they live inside the map pane).
    latLngToLayerPoint: () => ({ x: 10, y: 20 }),
    // Record the handler under every space-separated event token.
    on: (evts: string, fn: () => void) => { evts.split(' ').forEach((e) => { handlers[e] = fn; }); },
    off: () => {},
  };
  useAppStore.setState({
    mapEvents: MOCK_MAP_EVENTS, eventFilter: 'all',
    activeBuildingId: null, mapSelection: null, language: 'en',
  });
  setMapInstance(fakeMap);
});

afterEach(() => { setMapInstance(null); });

describe('EventLayer', () => {
  it('renders pins inside a Leaflet pane so panning moves them for free', () => {
    render(<EventLayer />);
    // A dedicated map pane is created and the pins are portaled into it — being
    // a child of the map pane is what makes panning track for free (no JS).
    expect(fakeMap.createdPane).toBe(true);
    expect(paneEl.querySelector('button')).toBeTruthy();
    // The pane can't ride the (event-less) zoom animation, so the layer hides
    // on zoom start and re-places on zoom end.
    expect(handlers.zoomstart).toBeTruthy();
    expect(handlers.zoomend).toBeTruthy();
  });

  it('hides pins during a zoom animation and restores them on zoomend', () => {
    render(<EventLayer />);
    const wrapper = paneEl.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.className).not.toContain('opacity-0');
    // zoomstart hides the overlay so pins don't drift while the basemap scales.
    act(() => { handlers.zoomstart(); });
    expect((paneEl.firstElementChild as HTMLElement).className).toContain('opacity-0');
    // zoomend re-places and shows them.
    act(() => { handlers.zoomend(); });
    expect((paneEl.firstElementChild as HTMLElement).className).not.toContain('opacity-0');
  });
});
