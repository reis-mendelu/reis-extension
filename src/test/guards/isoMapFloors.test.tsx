import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const handlers = new Map<string, (e: unknown) => void>();
const addTiledImage = vi.fn();
const removeItem = vi.fn();
let tapAt = { x: 0, y: 0 };
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
          pointFromPixel: () => tapAt,
          pixelFromPoint: () => ({ x: 120, y: 200 }),
        },
      };
    }),
  },
}));

import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';
import { floorHeights, isoRing } from '../../data/map/isoFloors';
import { IMG } from '../../data/map/isoView';
import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta, RoomFeature, RoomsCollection } from '../../types/campusMap';

/**
 * The floor the 2D map has open is drawn in the isometric picture, lifted to its height, and
 * the picture can be tapped to pick a room, open a building's floors or leave them.
 */
const Q = (buildingsJson as BuildingsMeta).buildings.find((b) => b.name === 'Q')!;
const fourth = Q.floors.find((f) => f.level === 4)!;
const [x0, y0] = Q.outline.coordinates[0]![0]!;
// A small room just inside the footprint's first corner.
const ring = [
  [x0!, y0!],
  [x0! + 0.00004, y0!],
  [x0! + 0.00004, y0! + 0.00003],
  [x0!, y0! + 0.00003],
  [x0!, y0!],
];
const room = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring] },
  properties: {
    id: 4101,
    buildingId: 0,
    floorId: fourth.id,
    floorLevel: 4,
    name: 'Q4.01',
    type: 'classroom',
    category: 'teaching',
    label: 'Q4.01',
    passportNumber: null,
    seats: 20,
    hasProjector: false,
    hasWhiteboard: false,
    code: null,
  },
} as unknown as RoomFeature;
const rooms = { type: 'FeatureCollection', features: [room] } as RoomsCollection;

const open = async () => {
  vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  await act(async () => {
    useAppStore.setState({ isoMapOpen: true });
    render(<IsoMapView />);
  });
};
const tapRoom = () => {
  const { baseM, floorM } = floorHeights(Q);
  const pts = isoRing(room.geometry.coordinates[0]!, baseM + 4 * floorM);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  tapAt = { x: cx / IMG.w, y: cy / IMG.w };
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
  it('draws nothing, and shows no floor column, while no building is open', async () => {
    await open();
    expect(screen.queryByTestId('iso-floor')).toBeNull();
    expect(screen.queryByText('-2')).toBeNull();
  });

  it('draws the open floor: the building above it frosted, the plate, its rooms; with the floor column', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: rooms },
    });
    await open();
    const svg = screen.getByTestId('iso-floor');
    // ghost + plate + one room, and the viewBox follows the viewer (picture pixels).
    expect(svg.querySelectorAll('path').length).toBeGreaterThanOrEqual(3);
    expect(svg.getAttribute('viewBox')).toBe(
      `${0.3 * IMG.w} ${0.3 * IMG.w} ${0.1 * IMG.w} ${0.2 * IMG.w}`
    );
    expect(svg.textContent).toContain('Q4.01');
    expect(screen.getByText('-2')).toBeTruthy(); // the same FloorStack as the 2D map
  });

  it('a tap on a room selects it; on bare ground it leaves the building', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: rooms },
    });
    await open();
    tapRoom();
    act(() => handlers.get('canvas-click')!({ quick: true, position: { x: 1, y: 1 } }));
    expect(useAppStore.getState().mapSelection).toMatchObject({ kind: 'room' });
    tapAt = { x: 0.01, y: 0.01 }; // nowhere near a building
    act(() => handlers.get('canvas-click')!({ quick: true, position: { x: 1, y: 1 } }));
    expect(useAppStore.getState().activeBuildingId).toBeNull();
  });

  it('a tap that is a drag does nothing', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: rooms },
    });
    await open();
    tapAt = { x: 0.01, y: 0.01 };
    act(() => handlers.get('canvas-click')!({ quick: false, position: { x: 1, y: 1 } }));
    expect(useAppStore.getState().activeBuildingId).toBe(0);
  });

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
});
