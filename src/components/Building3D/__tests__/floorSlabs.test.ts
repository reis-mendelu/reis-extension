import { describe, expect, it } from 'vitest';
import { Box3, Color, Mesh, MeshStandardMaterial } from 'three';
import { buildFloorSlab } from '../floorSlabs';
import { makeProjector } from '../projection';
import type { RoomFeature } from '../../../types/campusMap';

const ANCHOR: [number, number] = [16.6142, 49.2096];
const square = (lng: number, lat: number, d = 0.00005): number[][][] => [
  [
    [lng, lat],
    [lng + d, lat],
    [lng + d, lat + d],
    [lng, lat + d],
    [lng, lat],
  ],
];
const room = (id: number, lng: number): RoomFeature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: square(lng, 49.2096) },
  properties: {
    id,
    buildingId: 0,
    floorId: 3,
    floorLevel: 2,
    name: `Q${id}`,
    nickname: null,
    type: 'classroom',
    category: 'teaching',
    label: 'Classroom',
    passportNumber: null,
    seats: null,
    hasProjector: false,
    hasWhiteboard: false,
    code: null,
  },
});

const COLORS = { room: '#d4d4d4', target: '#16a34a', edge: '#737373' };
const build = (targetRoomId: number | null) =>
  buildFloorSlab({
    rooms: [room(1, 16.6142), room(2, 16.6143), room(3, 16.6144)],
    project: makeProjector(ANCHOR),
    elevation: 10,
    storeyHeight: 3.5,
    targetRoomId,
    colors: COLORS,
  });

const meshes = (targetRoomId: number | null) =>
  build(targetRoomId).children.filter((c): c is Mesh => c instanceof Mesh);

describe('buildFloorSlab', () => {
  it('draws one mesh per room', () => {
    expect(meshes(2)).toHaveLength(3);
  });

  it('paints the target room in the target colour and the rest in the room colour', () => {
    const colours = meshes(2).map(
      (m) => `#${(m.material as MeshStandardMaterial).color.getHexString()}`
    );
    expect(
      colours.filter((c) => c === new Color(COLORS.target).getStyle() || c === COLORS.target)
    ).toHaveLength(1);
    expect(colours.filter((c) => c === COLORS.room)).toHaveLength(2);
  });

  it('lays the floor on the storey elevation and raises the target room into a block', () => {
    const [flat, target] = [
      meshes(2).find((m) => m.userData.roomId === 1)!,
      meshes(2).find((m) => m.userData.roomId === 2)!,
    ];
    const flatBox = new Box3().setFromObject(flat);
    const targetBox = new Box3().setFromObject(target);
    expect(flatBox.min.y).toBeGreaterThanOrEqual(10);
    expect(flatBox.max.y - flatBox.min.y).toBeLessThan(0.2);
    expect(targetBox.max.y - targetBox.min.y).toBeGreaterThan(1.5);
    expect(targetBox.max.y).toBeLessThan(10 + 3.5);
  });

  it('places rooms where the projector says (east of the anchor is +x)', () => {
    const box = new Box3().setFromObject(meshes(null).find((m) => m.userData.roomId === 3)!);
    expect(box.min.x).toBeGreaterThan(10); // 0.0002° east ≈ 14.6 m
  });

  it('highlights nothing when there is no target', () => {
    const colours = meshes(null).map(
      (m) => `#${(m.material as MeshStandardMaterial).color.getHexString()}`
    );
    expect(colours.every((c) => c === COLORS.room)).toBe(true);
  });
});
