import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineLoop,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
} from 'three';
import buildingsJson from '../../../data/map/buildings.json';
import {
  BUILDING_STYLE,
  categoryStyle,
  SELECTED_STYLE,
  STRUCTURE_STYLE,
} from '../../CampusMap/mapHelpers';
import type { BuildingsMeta, RoomFeature } from '../../../types/campusMap';
import type { RoomLook } from '../floorSlabs';
import type { Projector } from '../projection';

const META = buildingsJson as BuildingsMeta;

/**
 * A room exactly as the flat map paints it — same fill, stroke and opacity as
 * MapCanvas's Leaflet polygons — so the rooms at the handover are the ones the
 * student was just looking at, and they rise into their floor from there.
 */
export function flatMapLook(room: RoomFeature, isTarget: boolean): RoomLook {
  if (isTarget)
    return {
      fill: SELECTED_STYLE.fillColor!,
      edge: SELECTED_STYLE.color!,
      flatOpacity: SELECTED_STYLE.fillOpacity!,
    };
  const p = room.properties;
  if (p.category === 'structure')
    return {
      fill: STRUCTURE_STYLE.fillColor!,
      edge: STRUCTURE_STYLE.color!,
      flatOpacity: STRUCTURE_STYLE.fillOpacity!,
    };
  const st = categoryStyle(p.category, p.type);
  return { fill: st.fill, edge: st.stroke, flatOpacity: 0.6 };
}

/** The other buildings' blue outlines, laid on the ground as Leaflet draws them. */
export function buildingOutlines(project: Projector, y: number, exceptId: number): Group {
  const group = new Group();
  const fill = new MeshBasicMaterial({
    color: BUILDING_STYLE.fillColor,
    transparent: true,
    opacity: BUILDING_STYLE.fillOpacity,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new LineBasicMaterial({ color: BUILDING_STYLE.color, toneMapped: false });
  for (const b of META.buildings) {
    if (b.id === exceptId) continue;
    const ring = b.outline.coordinates[0]?.map((p) => project(p));
    if (!ring || ring.length < 3) continue;
    const shape = new Shape();
    ring.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
    const geometry = new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geometry, fill);
    mesh.position.y = y;
    const edge = new BufferGeometry();
    edge.setAttribute(
      'position',
      new Float32BufferAttribute(
        ring.flatMap(([x, z]) => [x, y + 0.02, z]),
        3
      )
    );
    group.add(mesh, new LineLoop(edge, line));
  }
  return group;
}
