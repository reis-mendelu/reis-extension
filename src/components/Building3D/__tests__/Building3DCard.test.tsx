import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The real canvas imports three.js and needs WebGL; the card's job is deciding
// WHETHER to show it, which is what these tests pin.
const canvasRooms: unknown[][] = [];
vi.mock('../Building3DCanvas', () => ({
  default: (p: { ariaLabel: string; rooms: unknown[] }) => {
    canvasRooms.push(p.rooms);
    return (
      <canvas
        data-testid="building-3d-canvas"
        aria-label={p.ariaLabel}
        data-rooms={p.rooms.length}
      />
    );
  },
}));

import { Building3DCard } from '../Building3DCard';
import { resetWebGL2Probe } from '../webgl';
import { useAppStore } from '../../../store/useAppStore';
import type { BuildingModel } from '../../../types/buildingModel';
import type { RoomsCollection } from '../../../types/campusMap';
import type { RoomTarget } from '../roomTarget';

const MODEL = {
  glb: new ArrayBuffer(8),
  meta: { name: 'Q', attribution: '3D: © Statutární město Brno, CC BY 4.0', storeys: [] },
  fetchedAt: 1,
} as unknown as BuildingModel;
const room = (id: number, floorLevel: number) => ({
  type: 'Feature' as const,
  geometry: { type: 'Polygon' as const, coordinates: [[[16.61, 49.2]]] },
  properties: { id, floorLevel, buildingId: 0 } as never,
});
const ROOMS: RoomsCollection = {
  type: 'FeatureCollection',
  features: [room(1, 3), room(2, 3), room(3, 2)],
};
const Q301: RoomTarget = { buildingId: 0, floorLevel: 3, roomId: 1, label: 'Q301' };
const A01: RoomTarget = { buildingId: 54678, floorLevel: 1, roomId: 9, label: 'A01' };
const FLAT = <div data-testid="flat-thumbnail" />;

beforeEach(() => {
  resetWebGL2Probe(true);
  useAppStore.setState({
    language: 'cz',
    buildingModels: { 0: MODEL },
    roomsByBuilding: { 0: ROOMS },
  });
});
afterEach(() => resetWebGL2Probe());

describe('Building3DCard', () => {
  it('shows a Q room in 3D, cut at its floor, with the Brno credit', async () => {
    render(<Building3DCard target={Q301} fallback={FLAT} />);
    const canvas = await screen.findByTestId('building-3d-canvas');
    expect(canvas.dataset.rooms).toBe('2'); // only floor 3's rooms
    expect(screen.getByText('Q · 3. patro · Q301')).toBeInTheDocument();
    expect(screen.getByText('3D: © Statutární město Brno, CC BY 4.0')).toBeInTheDocument();
    expect(screen.queryByTestId('flat-thumbnail')).toBeNull();
  });

  it('leaves every other building exactly as it was', () => {
    useAppStore.setState({ roomsByBuilding: { 54678: ROOMS } });
    render(<Building3DCard target={A01} fallback={FLAT} />);
    expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
    expect(screen.queryByTestId('building-3d-card')).toBeNull();
  });

  it('falls back to the flat plan on a device without WebGL2', () => {
    resetWebGL2Probe(false);
    render(<Building3DCard target={Q301} fallback={FLAT} />);
    expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
    expect(screen.queryByTestId('building-3d-card')).toBeNull();
  });

  it('falls back while the model is loading and when it failed', () => {
    const states: Record<number, BuildingModel | 'failed'>[] = [{}, { 0: 'failed' }];
    for (const state of states) {
      useAppStore.setState({ buildingModels: state });
      const { unmount } = render(<Building3DCard target={Q301} fallback={FLAT} />);
      expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders nothing at all when the caller has no fallback (the map)', () => {
    const { container } = render(<Building3DCard target={A01} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the ground floor and basements the way students say them', async () => {
    render(<Building3DCard target={{ ...Q301, floorLevel: 0, label: 'Q03' }} />);
    expect(await screen.findByText('Q · přízemí · Q03')).toBeInTheDocument();
  });

  it('labels the floor in English too', async () => {
    useAppStore.setState({ language: 'en' });
    render(<Building3DCard target={Q301} fallback={FLAT} />);
    expect(await screen.findByText('Q · floor 3 · Q301')).toBeInTheDocument();
  });
});

describe('Building3DCard stability', () => {
  // A new rooms array rebuilds the WebGL scene, and callers make a new target
  // object on every render.
  it('hands the canvas the same rooms array across re-renders with an equal target', async () => {
    canvasRooms.length = 0;
    const { rerender } = render(<Building3DCard target={{ ...Q301 }} />);
    await screen.findByTestId('building-3d-canvas');
    rerender(<Building3DCard target={{ ...Q301 }} />);
    await screen.findByTestId('building-3d-card');
    expect(canvasRooms.length).toBeGreaterThanOrEqual(2);
    expect(new Set(canvasRooms).size).toBe(1);
  });
});
