import { describe, it, expect, vi } from 'vitest';

// Leaflet and the event pins are irrelevant to the search field; stubbed for
// the same reasons MapScreen.test.tsx gives.
vi.mock('../../../CampusMap/MapCanvas', () => ({
  MapCanvas: () => <div data-testid="mock-map-canvas" />,
}));
vi.mock('../../../CampusMap/EventLayer', () => ({
  EventLayer: () => <div data-testid="mock-event-layer" />,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapScreen } from '../MapScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { venueRowToPin } from '../../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../../test/fixtures/sklubVenueRow';

/**
 * WebKit zooms the whole page onto any focused text field whose font is under
 * 16px. In the Capacitor app that zoom is a trap: Capacitor switches the
 * WebView's pinch gesture off, so nothing can zoom back out, and the student is
 * stuck with an enlarged, clipped app until they restart it. A student reported
 * exactly this from the map search (13.5px) on iOS 18.
 *
 * happy-dom computes no Tailwind sizes, so this reads the class: an explicit
 * `text-[Npx]`, or `text-base` (1.0625rem, 17px in this theme).
 */
function fontPx(className: string): number | null {
  const arbitrary = className.match(/(?:^|\s)text-\[(\d+(?:\.\d+)?)px\](?:\s|$)/);
  if (arbitrary) return Number(arbitrary[1]);
  return /(?:^|\s)text-base(?:\s|$)/.test(className) ? 17 : null;
}

describe('MapScreen search field', () => {
  it('is at least 16px, so focusing it does not zoom the app', () => {
    render(<MapScreen />);
    const px = fontPx(screen.getByRole('textbox').className);
    expect(px, 'the field sets no font size of its own').not.toBeNull();
    expect(px).toBeGreaterThanOrEqual(16);
  });
});

describe('MapScreen search results', () => {
  it('lists a venue and opens its card on the campus when chosen', async () => {
    const sklub = venueRowToPin(SKLUB_VENUE_ROW)!;
    useAppStore.setState({
      language: 'cz',
      venuePins: [sklub],
      mapSearchQuery: '',
      mapSearchResults: [],
      activeBuildingId: 9000001,
      mapSelection: null,
    } as never);
    render(<MapScreen />);
    await userEvent.type(screen.getByRole('textbox'), 'pixie');
    const [hit] = await screen.findAllByRole('button', { name: 'S-klub Pixie' });
    await userEvent.click(hit!);
    expect(useAppStore.getState().mapSelection).toEqual({ kind: 'societyPin', pin: sklub });
    expect(useAppStore.getState().activeBuildingId).toBeNull();
  });
});
