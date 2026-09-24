import { describe, it, expect, vi } from 'vitest';

// Leaflet and the event pins are irrelevant to the search field; stubbed for
// the same reasons MapScreen.test.tsx gives.
vi.mock('../../../CampusMap/MapCanvas', () => ({
  MapCanvas: () => <div data-testid="mock-map-canvas" />,
}));
vi.mock('../../../CampusMap/EventLayer', () => ({
  EventLayer: () => <div data-testid="mock-event-layer" />,
}));
vi.mock('../../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu'], isLoading: false }),
}));

import { render, screen } from '@testing-library/react';
import { MapScreen } from '../MapScreen';

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
