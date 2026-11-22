import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const viewerCtor = vi.fn();
const destroy = vi.fn();
vi.mock('openseadragon', () => ({
  default: {
    Point: vi.fn(),
    Viewer: vi.fn().mockImplementation(function (opts: unknown) {
      viewerCtor(opts);
      return { destroy, addHandler: vi.fn(), viewport: { zoomTo: vi.fn(), panTo: vi.fn() } };
    }),
  },
}));

import { IsoMapButton } from '../../components/CampusMap/iso/IsoMapButton';
import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';
import { setMapInstance } from '../../components/CampusMap/mapInstance';
import type L from 'leaflet';
import { ISO_ATTRIBUTION } from '../../data/map/isoMap';
import cs from '../../i18n/locales/cs.json';

/**
 * The isometric campus map is a prototype: merged but OFF, on both trees.
 *
 * Off (no VITE_ISO_MAP_URL) has to mean nothing: no button, no layer, and the
 * OpenSeadragon chunk is never fetched. The shared components are mounted by
 * BOTH map screens, because the extension renders the phone tree too and a
 * capability on one tree only is how a platform gets forgotten.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  viewerCtor.mockClear();
  destroy.mockClear();
  useAppStore.setState({ isoMapOpen: false });
});

describe('the isometric map is dormant', () => {
  it('renders no button and no layer while it is off', () => {
    vi.stubEnv('VITE_ISO_MAP_URL', ''); // a developer's .env.local may switch it on
    useAppStore.setState({ isoMapOpen: true });
    const { container } = render(
      <div>
        <IsoMapButton />
        <IsoMapView />
      </div>
    );
    expect(container.innerHTML).toBe('<div></div>');
    expect(viewerCtor).not.toHaveBeenCalled();
  });
});

describe('the isometric map when switched on', () => {
  const on = () => vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');

  it('shows the button, and tapping it opens the layer', () => {
    on();
    render(
      <div>
        <IsoMapButton />
        <IsoMapView />
      </div>
    );
    expect(screen.queryByTestId('iso-map')).toBeNull();
    fireEvent.click(screen.getByTestId('iso-map-open'));
    expect(useAppStore.getState().isoMapOpen).toBe(true);
    expect(screen.getByTestId('iso-map')).toBeTruthy();
  });

  it('starts the viewer on the summer pyramid and credits the data', async () => {
    on();
    useAppStore.setState({ isoMapOpen: true });
    await act(async () => {
      render(<IsoMapView />);
    });
    expect(viewerCtor).toHaveBeenCalledTimes(1);
    const opts = viewerCtor.mock.calls[0]![0] as { tileSources: { Image: { Url: string } } };
    expect(opts.tileSources.Image.Url).toBe('http://localhost:8793/tiles/summer/');
    expect(screen.getByText('© přispěvatelé OpenStreetMap, © ČÚZK')).toBeTruthy();
  });

  it('closes, and lets go of the viewer', async () => {
    on();
    useAppStore.setState({ isoMapOpen: true });
    await act(async () => {
      render(<IsoMapView />);
    });
    fireEvent.click(screen.getByTestId('iso-map-close'));
    expect(useAppStore.getState().isoMapOpen).toBe(false);
    expect(destroy).toHaveBeenCalled();
  });
});

describe('the cube only works where the picture is', () => {
  const on = () => vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  /** A stand-in for the Leaflet map: a centre, and the events the button listens to. */
  const fakeMap = (lat: number, lng: number) => {
    const handlers = new Set<() => void>();
    const map = {
      centre: { lat, lng },
      getCenter() {
        return this.centre;
      },
      getZoom: () => 17,
      on: (_e: string, fn: () => void) => handlers.add(fn),
      off: (_e: string, fn: () => void) => handlers.delete(fn),
    };
    return {
      map,
      move: (la: number, ln: number) => (
        (map.centre = { lat: la, lng: ln }),
        handlers.forEach((h) => h())
      ),
    };
  };
  afterEach(() => act(() => setMapInstance(null)));

  it('is enabled on the campus and disabled once the 2D map is panned off the picture, and back', () => {
    on();
    const m = fakeMap(49.209592, 16.614247);
    act(() => setMapInstance(m.map as unknown as L.Map));
    render(<IsoMapButton />);
    const btn = screen.getByTestId('iso-map-open') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    act(() => m.move(50.0755, 14.4378)); // Prague
    expect(btn.disabled).toBe(true);
    // Disabled for a reason the student can read, not silently.
    expect(btn.getAttribute('aria-label')).toBe(cs.map.isoOffCampus);
    fireEvent.click(btn);
    expect(useAppStore.getState().isoMapOpen).toBe(false);
    act(() => m.move(49.209592, 16.614247));
    expect(btn.disabled).toBe(false);
  });

  it('is enabled when there is no 2D map to ask', () => {
    on();
    render(<IsoMapButton />);
    expect((screen.getByTestId('iso-map-open') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the isometric map closes itself, and is a proper modal', () => {
  const on = () => vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  const open = async (ui = <IsoMapView />) => {
    on();
    useAppStore.setState({ isoMapOpen: true });
    let r!: ReturnType<typeof render>;
    await act(async () => {
      r = render(ui);
    });
    return r;
  };

  it('closes on Escape', async () => {
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('closes when the screen hosting it goes away, so the flag cannot outlive it', async () => {
    const r = await open();
    r.unmount();
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('closes on a "show on map" request, which would otherwise land underneath', async () => {
    await open();
    act(() =>
      useAppStore.setState({ mapFocusRequest: useAppStore.getState().mapFocusRequest + 1 })
    );
    expect(useAppStore.getState().isoMapOpen).toBe(false);
  });

  it('is a labelled modal dialog that takes focus, shuts out what is behind it and gives focus back', async () => {
    on();
    useAppStore.setState({ isoMapOpen: false });
    const r = render(
      <div>
        <div data-testid="behind">
          <IsoMapButton />
        </div>
        <IsoMapView />
      </div>
    );
    const opener = screen.getByTestId('iso-map-open');
    opener.focus();
    await act(async () => {
      fireEvent.click(opener);
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId('iso-map-close'));
    expect((screen.getByTestId('behind') as HTMLElement & { inert: boolean }).inert).toBe(true);
    fireEvent.click(screen.getByTestId('iso-map-close'));
    expect((screen.getByTestId('behind') as HTMLElement & { inert: boolean }).inert).toBe(false);
    expect(document.activeElement).toBe(opener);
    r.unmount();
  });

  it("does not zoom on a plain click, and the credit is a link in the student's language", async () => {
    await open();
    const opts = viewerCtor.mock.calls[0]![0] as { gestureSettingsMouse: { clickToZoom: boolean } };
    expect(opts.gestureSettingsMouse.clickToZoom).toBe(false);
    const credit = screen.getByRole('link', { name: ISO_ATTRIBUTION });
    expect(credit.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
    // The constant is the required wording; the Czech string must not drift from it.
    expect(cs.map.isoCredit).toBe(ISO_ATTRIBUTION);
  });
});

describe('the isometric map is on both trees', () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');
  it.each(['components/CampusMap/CampusMapView.tsx', 'components/mobile/screens/MapScreen.tsx'])(
    '%s mounts the button and the layer',
    (file) => {
      expect(read(file)).toContain('<IsoMapButton');
      expect(read(file)).toContain('<IsoMapView');
    }
  );
});
