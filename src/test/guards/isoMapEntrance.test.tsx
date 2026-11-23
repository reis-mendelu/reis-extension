import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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
        world: { getItemCount: () => 1, removeItem: vi.fn() },
        addTiledImage: vi.fn(),
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
import { Q, fourth, room, stairs, wayRooms } from '../fixtures/isoQFloor';

const open = async () => {
  vi.stubEnv('VITE_ISO_MAP_URL', 'http://localhost:8793/tiles');
  await act(async () => {
    useAppStore.setState({ isoMapOpen: true });
    render(<IsoMapView />);
  });
};

afterEach(() => {
  vi.unstubAllEnvs();
  useAppStore.setState({
    isoMapOpen: false,
    activeBuildingId: null,
    activeFloorId: null,
    roomsByBuilding: {},
    mapSelection: null,
    isoRouteTo: null,
  });
});

/**
 * The way in, from the door. Only a student who says they start at the entrance gets a route:
 * nobody can say which floor anyone else is on.
 */
describe('the entrance in the isometric map', () => {
  const ground = Q.floors.find((f) => f.level === 0)!;
  const pick = { kind: 'room', room: room.properties } as const;

  it('marks the door on the ground floor, where the plate is level with it, and on no other floor', async () => {
    useAppStore.setState({ activeBuildingId: 0, activeFloorId: ground.id, roomsByBuilding: {} });
    await open();
    expect(screen.getByTestId('iso-door')).toBeTruthy();
    cleanup();
    useAppStore.setState({ activeFloorId: fourth.id });
    await open();
    expect(screen.queryByTestId('iso-door')).toBeNull();
  });

  it('offers the way from the entrance only for a picked room, and only on request', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: fourth.id,
      roomsByBuilding: { 0: wayRooms },
    });
    await open();
    expect(screen.queryByTestId('iso-route-toggle')).toBeNull();
    cleanup();
    useAppStore.setState({ mapSelection: pick });
    await open();
    expect(screen.getByTestId('iso-route-toggle')).toBeTruthy();
    expect(screen.queryByTestId('iso-route')).toBeNull();
    fireEvent.click(screen.getByTestId('iso-route-toggle'));
    // The door, the stairs, the room.
    expect(screen.getByTestId('iso-route').querySelectorAll('li')).toHaveLength(3);
    expect(useAppStore.getState().isoRouteTo?.id).toBe(room.properties.id);
    fireEvent.click(screen.getByTestId('iso-route-toggle'));
    expect(screen.queryByTestId('iso-route')).toBeNull();
  });

  it('lights the same stairs on the ground floor once the way is asked for, and not before', async () => {
    useAppStore.setState({
      activeBuildingId: 0,
      activeFloorId: ground.id,
      roomsByBuilding: { 0: wayRooms },
      mapSelection: pick,
    });
    await open();
    expect(screen.getByTestId('iso-treads').getAttribute('data-guide')).toBeNull();
    cleanup();
    // A change of floor clears the selection; the way asked for stays, with its card.
    useAppStore.setState({ mapSelection: null, isoRouteTo: room.properties });
    await open();
    expect(screen.getByTestId('iso-treads').getAttribute('data-guide')).toBe('true');
    expect(screen.getByTestId('iso-route').querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByTestId('iso-door').getAttribute('data-asked')).toBe('true');
  });

  it('forgets the way when another room is picked, or the map is closed', () => {
    useAppStore.setState({ isoRouteTo: room.properties });
    useAppStore.getState().selectMapRoom(stairs.properties);
    expect(useAppStore.getState().isoRouteTo).toBeNull();
    useAppStore.setState({ isoRouteTo: room.properties });
    useAppStore.getState().setIsoMapOpen(false);
    expect(useAppStore.getState().isoRouteTo).toBeNull();
  });

  it('leaves a building without a mapped door alone', async () => {
    const other = Q.floors.find((f) => f.level === 4)!;
    useAppStore.setState({
      activeBuildingId: 99,
      activeFloorId: other.id,
      roomsByBuilding: { 99: wayRooms },
      mapSelection: pick,
    });
    await open();
    expect(screen.queryByTestId('iso-route-toggle')).toBeNull();
    expect(screen.queryByTestId('iso-door')).toBeNull();
  });
});
