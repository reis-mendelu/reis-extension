import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const handlers = new Map<string, () => void>();
vi.mock('openseadragon', () => ({
  default: {
    Point: vi.fn().mockImplementation(function (this: { x: number; y: number }, x, y) {
      this.x = x;
      this.y = y;
    }),
    Viewer: vi.fn().mockImplementation(function () {
      return {
        destroy: vi.fn(),
        addHandler: (n: string, fn: () => void) => handlers.set(n, fn),
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

import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';

/**
 * The demo page (`npm run build:iso-demo`) is the picture and nothing else: there is no map under
 * it to go back to, so it offers no Close and Escape leaves it open.
 */
afterEach(() => {
  handlers.clear();
  vi.unstubAllEnvs();
  useAppStore.setState({ isoMapOpen: false } as never);
});

describe('the isometric map as a page of its own', () => {
  it('has no Close button and stays open on Escape', async () => {
    vi.stubEnv('VITE_ISO_MAP_URL', '/tiles');
    useAppStore.setState({ isoMapOpen: true } as never);
    await act(async () => {
      render(<IsoMapView closable={false} />);
    });
    expect(screen.getByTestId('iso-map')).toBeTruthy();
    expect(screen.queryByTestId('iso-map-close')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().isoMapOpen).toBe(true);
  });

  it('says it is loading until the first tile has loaded', async () => {
    vi.stubEnv('VITE_ISO_MAP_URL', '/tiles');
    useAppStore.setState({ isoMapOpen: true } as never);
    await act(async () => {
      render(<IsoMapView />);
    });
    expect(screen.getByRole('status').textContent).toMatch(/Načítám|Loading/);
    act(() => handlers.get('tile-loaded')!());
    expect(screen.queryByRole('status')).toBeNull();
  });
});
