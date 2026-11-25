import { useCallback, useEffect, useMemo, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { useAppStore } from '../../../store/useAppStore';
import { floorHeights } from '../../../data/map/isoFloors';
import { IMG, isoPixel } from '../../../data/map/isoView';

const META = buildingsJson as BuildingsMeta;

/**
 * The letter of every building that has floors (Q, A, B ...), over its roof. A building's colour in the
 * picture is the artist's, not a code, so without these a student cannot tell which one is Q. The letter
 * is the building's own name in the 2D map. Placed from OpenSeadragon's viewport on every frame, like the
 * event pins; the one whose floors are open has its rooms named instead, so it carries none.
 */
export function IsoBuildingLabels({
  viewer,
  osd,
}: {
  viewer: OpenSeadragon.Viewer;
  osd: typeof OpenSeadragon;
}) {
  const open = useAppStore((s) => s.activeBuildingId);
  const spots = useMemo(
    () =>
      META.buildings
        .filter((b) => b.id !== open)
        .map((b) => {
          // Over the roof, not the ground: the picture is tilted, and the roof is what a student looks at.
          const { px, py } = isoPixel(b.center[0], b.center[1], floorHeights(b).roofM);
          return { id: b.id, name: b.name, x: px / IMG.w, y: py / IMG.w };
        }),
    [open]
  );
  const [placed, setPlaced] = useState<{ id: number; name: string; x: number; y: number }[]>([]);

  const place = useCallback(() => {
    const w = viewer.container.clientWidth;
    const h = viewer.container.clientHeight;
    setPlaced(
      spots.flatMap((s) => {
        const p = viewer.viewport.pixelFromPoint(new osd.Point(s.x, s.y), true);
        return p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20
          ? []
          : [{ id: s.id, name: s.name, x: p.x, y: p.y }];
      })
    );
  }, [viewer, osd, spots]);

  useEffect(() => {
    const first = requestAnimationFrame(place);
    const events = ['animation', 'animation-finish', 'update-viewport', 'open', 'resize'] as const;
    events.forEach((e) => viewer.addHandler(e, place));
    return () => {
      cancelAnimationFrame(first);
      events.forEach((e) => viewer.removeHandler(e, place));
    };
  }, [viewer, place]);

  return (
    <div
      data-testid="iso-building-labels"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {placed.map((p) => (
        <span
          key={p.id}
          data-building={p.id}
          style={{ left: p.x, top: p.y }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-base-100/90 px-1.5 text-[13px] font-bold leading-5 text-base-content shadow-popover-heavy ring-1 ring-base-content/20"
        >
          {p.name}
        </span>
      ))}
    </div>
  );
}
