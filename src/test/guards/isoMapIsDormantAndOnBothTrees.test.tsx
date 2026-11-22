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
