import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const handlers = new Map<string, (e: unknown) => void>();
const addTiledImage = vi.fn();
const removeItem = vi.fn();
let tapAt = { x: 0, y: 0 };
let pixelAt = { x: 120, y: 200 };
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
          pixelFromPoint: () => pixelAt,
        },
      };
    }),
  },
}));

import { IsoMapView } from '../../components/CampusMap/iso/IsoMapView';
import { useAppStore } from '../../store/useAppStore';
import { floorHeights, isoRing } from '../../data/map/isoFloors';
import { IMG } from '../../data/map/isoView';
import { Q, fourth, room, rooms, stairRooms } from '../fixtures/isoQFloor';

/**
 * The floor the 2D map has open is drawn in the isometric picture, lifted to its height, and
 * the picture can be tapped to pick a room, open a building's floors or leave them.
 */

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
  pixelAt = { x: 120, y: 200 };
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

  it('tells assistive technology which floor is open, not only by colour', async () => {
    useAppStore.setState({ activeBuildingId: 0, activeFloorId: fourth.id, roomsByBuilding: {} });
    await open();
    expect(screen.getByRole('button', { name: '4' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: '-2' }).getAttribute('aria-current')).toBeNull();
  });

  it('frosts the building above the floor as one path per face, so no two faces cancel each other out', async () => {
    useAppStore.setState({ activeBuildingId: 0, activeFloorId: fourth.id, roomsByBuilding: {} });
    await open();
    // A wall per edge plus the roof: faces that overlap with opposite winding would leave holes in one path.
    const faces = screen.getByTestId('iso-ghost').querySelectorAll('path');
    expect(faces.length).toBe(Q.outline.coordinates[0]!.length);
    faces.forEach((f) => expect((f.getAttribute('d')!.match(/M/g) ?? []).length).toBe(1));
  });

  it('draws a stairwell as steps, with no arrow, and a classroom as a plain room', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: stairRooms },
    });
    await open();
    const treads = screen.getAllByTestId('iso-treads');
    expect(treads).toHaveLength(1);
    expect((treads[0]!.getAttribute('d')!.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('does not light up any stairs for a picked room', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: stairRooms },
      mapSelection: { kind: 'room', room: room.properties },
    });
    await open();
    const treads = screen.getByTestId('iso-treads');
    expect(treads.getAttribute('data-guide')).toBeNull();
    expect(treads.className).not.toContain('animate-pulse');
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
});
