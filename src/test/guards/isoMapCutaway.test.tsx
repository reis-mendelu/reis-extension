import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const handlers = new Map<string, (e: unknown) => void>();
const addTiledImage = vi.fn();
const removeItem = vi.fn();
vi.mock('openseadragon', () => ({
  default: {
    Point: vi.fn().mockImplementation(function (this: { x: number; y: number }, x, y) {
      this.x = x;
      this.y = y;
    }),
    Viewer: vi.fn().mockImplementation(function () {
      return {
        destroy: vi.fn(),
        addHandler: (n: string, fn: (e: unknown) => void) => handlers.set(n, fn),
        removeHandler: vi.fn(),
        world: { getItemCount: () => 1, removeItem },
        addTiledImage,
        container: { clientWidth: 390, clientHeight: 844 },
        viewport: {
          zoomTo: vi.fn(),
          panTo: vi.fn(),
          applyConstraints: vi.fn(),
          getMinZoom: () => 1,
          getZoom: () => 3,
          getBounds: () => ({ x: 0.3, y: 0.3, width: 0.1, height: 0.2 }),
          pointFromPixel: () => ({ x: 0, y: 0 }),
          pixelFromPoint: () => ({ x: 120, y: 200 }),
        },
      };
    }),
  },
}));

import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';
import { IMG } from '../../data/map/isoView';
import { Q, fourth, rooms } from '../fixtures/isoQFloor';

/** The floor's patch of the picture and the ruler up the building's corner. */
const open = async () => {
  vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  await act(async () => {
    useAppStore.setState({ isoMapOpen: true });
    render(<IsoMapView />);
  });
};

afterEach(() => {
  vi.unstubAllEnvs();
  handlers.clear();
  addTiledImage.mockClear();
  removeItem.mockClear();
  useAppStore.setState({
    isoMapOpen: false,
    activeBuildingId: null,
    activeFloorId: null,
    roomsByBuilding: {},
    mapSelection: null,
  });
});

describe('floors in the isometric map', () => {
  describe('a building that ends at the floor', () => {
    const openFloor = async (level: number) => {
      useAppStore.setState({
        activeBuildingId: 0,
        activeFloorId: Q.floors.find((f) => f.level === level)!.id,
        roomsByBuilding: { 0: rooms },
      });
      await open();
    };
    const requested = () => addTiledImage.mock.calls.at(-1)![0] as Record<string, unknown>;

    it('asks for the re-rendered patch of that floor, placed in the picture, and drops the frosting once it is drawn', async () => {
      await openFloor(2);
      expect(addTiledImage).toHaveBeenCalledTimes(1);
      expect(requested()).toMatchObject({
        tileSource: { type: 'image', url: 'http://localhost:8793/tiles/summer/cutaway/b0-2.webp' },
        x: 5512 / IMG.w,
        y: 5207 / IMG.w,
        width: 584 / IMG.w,
      });
      expect(screen.getByTestId('iso-ghost')).toBeTruthy(); // still loading: frosted meanwhile
      const item = {};
      act(() => (requested().success as (e: { item: object }) => void)({ item }));
      expect(screen.queryByTestId('iso-ghost')).toBeNull();
      act(() => useAppStore.setState({ activeBuildingId: null }));
      expect(removeItem).toHaveBeenCalledWith(item); // leaving the building puts the real one back
    });

    it('uses the building-removed patch for every floor below ground', async () => {
      await openFloor(-1);
      expect(String((requested().tileSource as { url: string }).url)).toMatch(/b0-g\.webp$/);
    });

    it('keeps the frosting when the patch never arrives', async () => {
      await openFloor(3);
      expect(screen.getByTestId('iso-ghost')).toBeTruthy();
    });

    it('puts back a patch that arrives after its floor was left', async () => {
      await openFloor(3);
      const success = requested().success as (e: { item: object }) => void;
      act(() => useAppStore.setState({ activeBuildingId: null }));
      const late = {};
      act(() => success({ item: late }));
      expect(removeItem).toHaveBeenCalledWith(late);
    });
  });

  it('counts the floors on the building: a ruler up its corner, the open floor standing out', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: rooms },
    });
    await open();
    const ruler = await screen.findByTestId('iso-ruler');
    await waitFor(() => expect(ruler.querySelectorAll('span').length).toBe(5)); // levels 0..4
    expect(ruler.querySelector('[data-active="true"]')?.textContent).toBe('4');
  });

  it('shortens the ruler when a lower floor is chosen, without a frame in between', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: rooms },
    });
    await open();
    const ruler = await screen.findByTestId('iso-ruler');
    await waitFor(() => expect(ruler.querySelectorAll('span').length).toBe(5));
    act(() => useAppStore.setState({ activeFloorId: Q.floors.find((f) => f.level === 2)!.id }));
    expect(screen.getByTestId('iso-ruler').querySelectorAll('span').length).toBeLessThanOrEqual(4);
  });
});
