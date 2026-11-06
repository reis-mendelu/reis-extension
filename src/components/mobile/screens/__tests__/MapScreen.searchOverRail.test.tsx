import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Leaflet and its event pane do not exist in happy-dom; see MapScreen.test.tsx.
vi.mock('../../../CampusMap/MapCanvas', () => ({
  MapCanvas: () => <div data-testid="mock-map-canvas" />,
}));
vi.mock('../../../CampusMap/EventLayer', () => ({
  EventLayer: () => <div data-testid="mock-event-layer" />,
}));

import { render, screen } from '@testing-library/react';
import { MapScreen } from '../MapScreen';
import { useAppStore } from '../../../../store/useAppStore';

function setViewport(width: number, height: number) {
  (
    window as unknown as {
      happyDOM?: { setViewport(v: { width: number; height: number }): void };
    }
  ).happyDOM?.setViewport({ width, height });
}

/** The z-index a Tailwind `z-[N]` class gives an element, or 0. */
function zOf(el: Element): number {
  const m = /(?:^|\s)z-\[(\d+)\]/.exec(el.className);
  return m ? Number(m[1]) : 0;
}

// Reported from the iPad 8 (Task List, "map bug on ipad"): typing in the map
// search opened the results under the Akce rail. Both float at z-1000 in the
// same stacking context and the rail comes later in the DOM, so the rail
// painted over the dropdown's right-hand side and the rows behind it.
describe('MapScreen search results on a tablet', () => {
  beforeEach(() => {
    setViewport(1080, 810);
    useAppStore.setState({
      language: 'cz',
      mapRailOpen: true,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      societyMapEvents: [],
      activeBuildingId: null,
      adminConsoleOpen: false,
      adminRole: null,
    } as never);
  });
  afterAll(() => setViewport(390, 844));

  it('opens above the open rail', () => {
    useAppStore.getState().setMapSearchQuery('Q0');
    render(<MapScreen />);
    const results = screen.getAllByRole('listitem')[0]!.closest('ul')!;
    const search = results.parentElement!;
    const rail = screen.getByTestId('map-rail');
    expect(zOf(search)).toBeGreaterThan(zOf(rail));
  });
});
