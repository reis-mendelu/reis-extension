import {
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { RoomFeature } from '../../types/campusMap';
import type { Projector } from './projection';

export interface SlabColors {
  room: string;
  target: string;
  edge: string;
}

/** How one room looks: the card's own palette, or the 2D map's (tilted map). */
export interface RoomLook {
  fill: string;
  edge: string;
  /** Unlit and translucent, the way Leaflet paints the same polygon. */
  flatOpacity?: number;
}

interface SlabInput {
  rooms: RoomFeature[];
  project: Projector;
  elevation: number;
  storeyHeight: number;
  targetRoomId: number | null;
  colors: SlabColors;
  /** Override the look per room — the tilted map matches the flat map's colours. */
  lookOf?: (room: RoomFeature, isTarget: boolean) => RoomLook;
  /** Build a room's outline from its edge set (the tilted map draws real widths). */
  makeEdges?: (
    edges: BufferGeometry,
    color: string,
    opacity: number,
    isTarget: boolean
  ) => Object3D;
}

// Just above the storey's own floor, so the rooms never z-fight with it.
const LIFT_OFF_FLOOR = 0.06;

/**
 * Shape points are (x, -z): a Shape lives in the XY plane, and rotating it
 * -90° about X sends (x, y) to (x, 0, -y) — back to the model's z.
 */
function roomShape(ring: number[][], project: Projector): Shape {
  const pts = ring.map((p) => project(p));
  const shape = new Shape();
  pts.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  return shape;
}

/**
 * One floor's rooms, drawn inside the cut-open storey: every room a flat tile,
 * the lesson's room raised into a block of the brand colour so it reads as a
 * place, not a highlight. Built from the room outlines the app already caches —
 * the model itself is only the shell.
 */
export function buildFloorSlab({
  rooms,
  project,
  elevation,
  storeyHeight,
  targetRoomId,
  colors,
  lookOf,
  makeEdges,
}: SlabInput): Group {
  const group = new Group();
  for (const room of rooms) {
    const ring = room.geometry.coordinates[0];
    if (!ring || ring.length < 4) continue;
    const isTarget = room.properties.id === targetRoomId;
    const shape = roomShape(ring, project);
    const geometry: BufferGeometry = isTarget
      ? new ExtrudeGeometry(shape, {
          depth: Math.min(2.8, storeyHeight - 0.4),
          bevelEnabled: false,
        })
      : new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const look = lookOf?.(room, isTarget);
    const material = look?.flatOpacity
      ? new MeshBasicMaterial({
          color: look.fill,
          transparent: true,
          opacity: look.flatOpacity,
          toneMapped: false,
        })
      : new MeshStandardMaterial({
          color: look?.fill ?? (isTarget ? colors.target : colors.room),
          emissive: isTarget ? (look?.fill ?? colors.target) : '#000000',
          emissiveIntensity: isTarget ? 0.35 : 0,
          roughness: 0.8,
        });
    const mesh = new Mesh(geometry, material);
    // The lit room sits a hair higher, so its outline wins over the neighbours'
    // outlines along the walls they share.
    mesh.position.y = elevation + LIFT_OFF_FLOOR + (isTarget ? 0.08 : 0);
    mesh.userData.roomId = room.properties.id;
    group.add(mesh);
    const edgeColor = look?.edge ?? colors.edge;
    const edgeOpacity = look ? 1 : 0.6;
    const edges = makeEdges
      ? makeEdges(new EdgesGeometry(geometry), edgeColor, edgeOpacity, isTarget)
      : new LineSegments(
          new EdgesGeometry(geometry),
          new LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOpacity })
        );
    edges.position.y = mesh.position.y + 0.01;
    edges.userData.roomId = room.properties.id;
    group.add(edges);
  }
  return group;
}
