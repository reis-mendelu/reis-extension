import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('openseadragon', () => ({
  default: {
    Point: vi.fn().mockImplementation(function (this: { x: number; y: number }, x, y) {
      this.x = x;
      this.y = y;
    }),
    Viewer: vi.fn().mockImplementation(function () {
      return {
        destroy: vi.fn(),
        addHandler: vi.fn(),
        removeHandler: vi.fn(),
        container: { clientWidth: 390, clientHeight: 844 },
        viewport: {
          zoomTo: vi.fn(),
          panTo: vi.fn(),
          applyConstraints: vi.fn(),
          getZoom: () => 3,
          pixelFromPoint: () => ({ x: 120, y: 200 }),
        },
      };
    }),
  },
}));

vi.mock('../../api/featureUsage', () => ({ trackMapEventView: vi.fn() }));

import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';
import { MOCK_MAP_EVENTS } from '../../components/CampusMap/__tests__/fixtures/mockMapEvents';
import { localTodayIso } from '../../components/CampusMap/eventWindow';
import { trackMapEventView } from '../../api/featureUsage';
import cs from '../../i18n/locales/cs.json';

/**
 * The 2D map's event pins live on the isometric map too: the same events, placed by the
 * picture's own projection, and a tap opens the same card without leaving the picture.
 */
const today = () => localTodayIso(new Date());
const event = (id: string, coord: [number, number] | null) =>
  ({
    ...MOCK_MAP_EVENTS[1]!,
    id,
    title: `Akce ${id}`,
    coord,
    date: today(),
    endDate: null,
  }) as never;

const open = async (events: unknown[]) => {
  vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  useAppStore.setState({ isoMapOpen: true, mapEvents: events } as never);
  await act(async () => {
    render(<IsoMapView />);
  });
};

afterEach(() => {
  vi.unstubAllEnvs();
  useAppStore.setState({ isoMapOpen: false, mapEvents: [], mapSelection: null } as never);
});

describe('events on the isometric map', () => {
  it('pins an event on the campus and leaves out one the picture does not cover', async () => {
    await open([
      event('campus', [16.614247, 49.209592]), // Q: [lng, lat]
      event('prague', [14.4378, 50.0755]),
      event('nowhere', null),
    ]);
    // Pins are placed a frame after the viewer exists.
    await waitFor(() =>
      expect(screen.getByTestId('iso-pins').querySelectorAll('button')).toHaveLength(1)
    );
    const pins = screen.getByTestId('iso-pins').querySelectorAll('button');
    expect(pins[0]!.getAttribute('title')).toBe('Akce campus');
  });

  it('a tap opens the event card over the picture, which stays open', async () => {
    await open([event('campus', [16.614247, 49.209592])]);
    fireEvent.click(await screen.findByTitle('Akce campus'));
    expect(screen.getByTestId('iso-event-card')).toBeTruthy();
    expect(useAppStore.getState().isoMapOpen).toBe(true);
    expect(trackMapEventView).toHaveBeenCalledWith('campus');
    // The card is the 2D map's own, and Escape peels it before the map.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('iso-event-card')).toBeNull();
    expect(useAppStore.getState().isoMapOpen).toBe(true);
  });

  it('"Show on map" hands the event to the 2D map, which closes the picture', async () => {
    await open([event('campus', [16.614247, 49.209592])]);
    fireEvent.click(await screen.findByTitle('Akce campus'));
    fireEvent.click(screen.getByText(cs.map.isoShowOnMap));
    expect(useAppStore.getState().isoMapOpen).toBe(false);
    expect(useAppStore.getState().mapSelection?.kind).toBe('event');
  });
});
