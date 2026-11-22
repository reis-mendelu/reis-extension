import { useEffect, useMemo, useRef } from 'react';
import type OpenSeadragon from 'openseadragon';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta, RoomFeature } from '../../../types/campusMap';
import { useAppStore } from '../../../store/useAppStore';
import { IMG } from '../../../data/map/isoView';
import {
  floorHeights,
  frameBuilding,
  inRing,
  isoRing,
  onBuilding,
  svgPath,
  volumeAbove,
} from '../../../data/map/isoFloors';
import { categoryStyle, polygonCentroid, roomLabel } from '../mapHelpers';
import { selectedRoomId } from '../roomTints';

const META = buildingsJson as BuildingsMeta;
const LABEL_PX = 11;
/** Room names are placed biggest room first, and a name that would land on one already placed is left out. */
const LABEL_PX_PER_LETTER = 6;

/**
 * One floor of a building, drawn where it really is in the picture: the floor plan lifted to
 * its height above the ground, with the building above it frosted over so the plate reads as
 * a slice through the building. The floor is the one the 2D map has open (the same store
 * state and the same floor column), so a student arrives from the 2D floor view at the same
 * room and floor, and a tap on a building here opens its floors there.
 *
 * Drawn in picture pixels inside an SVG whose viewBox follows the viewer's own viewport on
 * every frame: no per-vertex work while panning or zooming, and the plan cannot drift.
 */
export function IsoFloorLayer({
  viewer,
  osd,
}: {
  viewer: OpenSeadragon.Viewer;
  osd: typeof OpenSeadragon;
}) {
  const buildingId = useAppStore((s) => s.activeBuildingId);
  const floorId = useAppStore((s) => s.activeFloorId);
  const rooms = useAppStore((s) =>
    s.activeBuildingId === null ? undefined : s.roomsByBuilding[s.activeBuildingId]
  );
  const selId = useAppStore((s) => selectedRoomId(s.mapSelection));
  const svg = useRef<SVGSVGElement>(null);
  const labels = useRef<SVGGElement>(null);

  const scene = useMemo(() => {
    const b = META.buildings.find((x) => x.id === buildingId);
    const floor = b?.floors.find((f) => f.id === floorId);
    if (!b || !floor) return null;
    const { floorM, roofM } = floorHeights(b);
    const z = floor.level * floorM;
    const ring = b.outline.coordinates[0]!;
    const plate = isoRing(ring, z);
    const feats = (rooms?.features ?? []).filter((f) => f.properties.floorId === floorId);
    const placed = feats.map((f) => {
      const r = isoRing(f.geometry.coordinates[0]!, z);
      const [cx, cy] = polygonCentroid(r);
      const xs = r.map((p) => p[0]);
      const ys = r.map((p) => p[1]);
      return {
        f,
        ring: r,
        at: [cx, cy] as [number, number],
        area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
      };
    });
    return {
      z,
      plate,
      ghost: svgPath(volumeAbove(ring, Math.max(z, 0), roofM)),
      legs:
        z > 0
          ? svgPath(isoRing(ring, 0).map((p, i) => [p, plate[i]!] as [number, number][])).replace(
              /Z/g,
              ''
            )
          : '',
      placed,
    };
  }, [buildingId, floorId, rooms]);

  // The viewBox is the viewer's own view, in picture pixels; text keeps a constant size on screen.
  useEffect(() => {
    const sync = () => {
      const el = svg.current;
      if (!el) return;
      const b = viewer.viewport.getBounds(true);
      const w = b.width * IMG.w;
      el.setAttribute('viewBox', `${b.x * IMG.w} ${b.y * IMG.w} ${w} ${b.height * IMG.w}`);
      const s = viewer.container.clientWidth / w;
      const g = labels.current;
      if (g) {
        g.style.fontSize = `${LABEL_PX / s}px`;
        g.setAttribute('stroke-width', String(3 / s));
        const taken: { x: number; y: number; w: number; h: number }[] = [];
        const names = Array.from(g.children) as SVGTextElement[];
        // The selected room first (always named), then by room size (DOM order is largest first).
        const order = [
          ...names.filter((t) => t.dataset.sel),
          ...names.filter((t) => !t.dataset.sel),
        ];
        for (const t of order) {
          const w = Number(t.dataset.n) * LABEL_PX_PER_LETTER + 4;
          const h = LABEL_PX + 3;
          const x = (Number(t.dataset.x) - b.x * IMG.w) * s;
          const y = (Number(t.dataset.y) - b.y * IMG.w) * s;
          const seen =
            x > -w &&
            y > -h &&
            x < viewer.container.clientWidth + w &&
            y < viewer.container.clientHeight + h;
          const clear = !taken.some(
            (r) => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < (r.h + h) / 2
          );
          const show = !!t.dataset.sel || (seen && clear);
          t.style.display = show ? '' : 'none';
          if (show) taken.push({ x, y, w, h });
        }
      }
    };
    sync();
    const events = ['animation', 'animation-finish', 'update-viewport', 'open', 'resize'] as const;
    events.forEach((e) => viewer.addHandler(e, sync));
    return () => events.forEach((e) => viewer.removeHandler(e, sync));
  }, [viewer, scene, selId]);

  // Opening another building's floors (a tap here, or the floor column) brings it into view.
  // The first opening, with the picture still loading, is framed by the viewer's own 'open'.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const b = META.buildings.find((x) => x.id === buildingId);
    if (!b || viewer.world.getItemCount() === 0) return;
    const to = frameBuilding(b, viewer.container.clientWidth / viewer.container.clientHeight);
    viewer.viewport.zoomTo(Math.max(to.zoom, viewer.viewport.getMinZoom()));
    viewer.viewport.panTo(new osd.Point(to.x, to.y));
  }, [viewer, osd, buildingId]);

  // A tap on the picture: a room of the open floor, else a building (open its floors), else the street (leave).
  useEffect(() => {
    const onTap = (e: OpenSeadragon.CanvasClickEvent) => {
      if (!e.quick) return;
      const v = viewer.viewport.pointFromPixel(e.position, true);
      const x = v.x * IMG.w;
      const y = v.y * IMG.w;
      const s = useAppStore.getState();
      const room = scene?.placed.find(
        (p) => p.f.properties.category !== 'structure' && inRing(x, y, p.ring)
      );
      if (room) return s.selectMapRoom(room.f.properties);
      // The building in front wins where two overlap: the southernmost, nearest the camera.
      const hit = META.buildings
        .filter((b) => onBuilding(x, y, b.outline.coordinates[0]!, floorHeights(b).roofM))
        .sort((a, b) => a.center[0] - b.center[0])[0];
      if (hit) {
        if (hit.id !== s.activeBuildingId) s.setMapBuilding(hit.id);
      } else if (s.activeBuildingId !== null) s.exitToCampus();
    };
    viewer.addHandler('canvas-click', onTap);
    return () => {
      viewer.removeHandler('canvas-click', onTap);
    };
  }, [viewer, scene]);

  if (!scene) return null;
  const nonScaling = { vectorEffect: 'non-scaling-stroke' } as const;
  return (
    <svg
      ref={svg}
      data-testid="iso-floor"
      aria-hidden="true"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g opacity="0.55">
        <path d={scene.ghost} fill="#f8fafc" stroke="#f8fafc" strokeWidth="2" {...nonScaling} />
      </g>
      {scene.legs && (
        <path
          d={scene.legs}
          fill="none"
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.7"
          {...nonScaling}
        />
      )}
      <path
        d={svgPath([scene.plate])}
        fill="#f1f5f9"
        fillOpacity="0.92"
        stroke="#334155"
        strokeWidth="2"
        {...nonScaling}
      />
      {scene.placed.map(({ f, ring }) => (
        <RoomShape key={f.properties.id} f={f} ring={ring} selected={f.properties.id === selId} />
      ))}
      <g
        ref={labels}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0f172a"
        stroke="#f8fafc"
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {scene.placed
          .filter(({ f }) => f.properties.category !== 'structure')
          .sort((a, b) => b.area - a.area)
          .map(({ f, at }) => {
            const label = roomLabel(
              f.properties.name,
              f.properties.passportNumber,
              f.properties.nickname
            );
            return (
              <text
                key={f.properties.id}
                x={at[0]}
                y={at[1]}
                data-sel={f.properties.id === selId ? 'true' : undefined}
                data-x={at[0]}
                data-y={at[1]}
                data-n={label.length}
                fontWeight={f.properties.id === selId ? 700 : 400}
              >
                {label}
              </text>
            );
          })}
      </g>
    </svg>
  );
}

function RoomShape({
  f,
  ring,
  selected,
}: {
  f: RoomFeature;
  ring: [number, number][];
  selected: boolean;
}) {
  const struct = f.properties.category === 'structure';
  const st = categoryStyle(f.properties.category, f.properties.type);
  return (
    <path
      d={svgPath([ring])}
      fill={selected ? '#fb923c' : struct ? '#e3e6ea' : st.fill}
      fillOpacity={selected ? 0.95 : struct ? 0.5 : 0.75}
      stroke={selected ? '#ea580c' : struct ? '#c2c8d0' : st.stroke}
      strokeWidth={selected ? 3 : 1}
      vectorEffect="non-scaling-stroke"
    />
  );
}
