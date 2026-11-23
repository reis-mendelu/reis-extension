import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

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

import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';

/**
 * A building's colour in the picture is the artist's (Q is blue, the rest keep their real roofs),
 * so a student cannot tell Q from A or B by colour: the buildings that have floors carry their letter.
 */
const open = async () => {
  vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  useAppStore.setState({ isoMapOpen: true } as never);
  await act(async () => {
    render(<IsoMapView />);
  });
};

afterEach(() => {
  vi.unstubAllEnvs();
  useAppStore.setState({ isoMapOpen: false, activeBuildingId: null, activeFloorId: null } as never);
});

describe('building letters on the isometric map', () => {
  it('names every building that has floors by its letter', async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId('iso-building-labels')).toBeTruthy());
    const letters = Array.from(
      screen.getByTestId('iso-building-labels').querySelectorAll('[data-building]')
    ).map((e) => e.textContent);
    expect(letters.sort()).toEqual(['A', 'B', 'C', 'E', 'M', 'Q', 'X', 'Z']);
  });

  it('does not label the building whose floors are open: its rooms are named instead', async () => {
    useAppStore.setState({ activeBuildingId: 0 } as never);
    await open();
    await waitFor(() => expect(screen.getByTestId('iso-building-labels')).toBeTruthy());
    const letters = Array.from(
      screen.getByTestId('iso-building-labels').querySelectorAll('[data-building]')
    ).map((e) => e.textContent);
    expect(letters).not.toContain('Q');
    expect(letters).toContain('A');
  });
});
