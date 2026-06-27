import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu', 'pef'], isLoading: false }),
}));
import { render, act } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from '../../../api/mapEvents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handlers: Record<string, (...a: any[]) => void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeMap: any;

beforeEach(() => {
  handlers = {};
  fakeMap = {
    // Record the handler under every space-separated event token.
    on: (evts: string, fn: () => void) => { evts.split(' ').forEach((e) => { handlers[e] = fn; }); },
    off: () => {},
    latLngToContainerPoint: () => ({ x: 10, y: 20 }),
  };
  useAppStore.setState({
    mapEvents: MOCK_MAP_EVENTS, eventFilter: 'all',
    activeBuildingId: null, mapSelection: null, language: 'en',
  });
  setMapInstance(fakeMap);
});

afterEach(() => { setMapInstance(null); });

describe('EventLayer', () => {
  it('reprojects on continuous pan (move) and binds zoom start/end', () => {
    render(<EventLayer />);
    // Panning fires continuous `move`; `moveend` settles the final position.
    expect(handlers.move).toBeTruthy();
    expect(handlers.moveend).toBeTruthy();
    // Animated zoom fires no continuous events, so the layer hides on start
    // and re-places on end instead of trying to track mid-animation.
    expect(handlers.zoomstart).toBeTruthy();
    expect(handlers.zoomend).toBeTruthy();
  });

  it('hides pins during a zoom animation and restores them on zoomend', () => {
    const { container } = render(<EventLayer />);
    // zoomend populates positions and shows the overlay.
    act(() => { handlers.zoomend(); });
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.className).not.toContain('opacity-0');
    // zoomstart hides the overlay so pins don't drift while the basemap scales.
    act(() => { handlers.zoomstart(); });
    expect((container.firstElementChild as HTMLElement).className).toContain('opacity-0');
  });
});
