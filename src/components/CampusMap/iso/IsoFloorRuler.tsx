import { useCallback, useEffect, useMemo, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { useAppStore } from '../../../store/useAppStore';
import { IMG } from '../../../data/map/isoView';
import { floorTicks } from '../../../data/map/isoFloors';

const META = buildingsJson as BuildingsMeta;

/**
 * The floor, counted on the building itself: a ruler of floor numbers up its nearest corner,
 * from the ground floor to the open one, which is the one that stands out. A student sees at
 * a glance "four above the ground", without knowing how this building numbers its floors.
 * Placed from OpenSeadragon's own viewport on every frame, like the event pins.
 */
export function IsoFloorRuler({
  viewer,
  osd,
}: {
  viewer: OpenSeadragon.Viewer;
  osd: typeof OpenSeadragon;
}) {
  const buildingId = useAppStore((s) => s.activeBuildingId);
  const floorId = useAppStore((s) => s.activeFloorId);
  const ticks = useMemo(() => {
    const b = META.buildings.find((x) => x.id === buildingId);
    const level = b?.floors.find((f) => f.id === floorId)?.level;
    return b && level !== undefined ? floorTicks(b, level) : [];
  }, [buildingId, floorId]);
  const [placed, setPlaced] = useState<{ x: number; y: number }[]>([]);

  const place = useCallback(() => {
    setPlaced(
      ticks.map((t) => {
        const p = viewer.viewport.pixelFromPoint(new osd.Point(t.px / IMG.w, t.py / IMG.w), true);
        return { x: p.x, y: p.y };
      })
    );
  }, [viewer, osd, ticks]);

  useEffect(() => {
    // Placed a frame later, not in the effect body: the viewer's own events do the rest.
    const first = requestAnimationFrame(place);
    const events = ['animation', 'animation-finish', 'update-viewport', 'open', 'resize'] as const;
    events.forEach((e) => viewer.addHandler(e, place));
    return () => {
      cancelAnimationFrame(first);
      events.forEach((e) => viewer.removeHandler(e, place));
    };
  }, [viewer, place]);

  const last = ticks.length - 1;
  // Storeys that sit closer than a numeral is tall (zoomed out, or a low storey) are dots, so they never overlap.
  const spacing = placed.length > 1 ? Math.abs(placed[1]!.y - placed[0]!.y) : Infinity;
  const dots = spacing < 16;
  return (
    <div
      aria-hidden="true"
      data-testid="iso-ruler"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {placed.map((p, i) => {
        const open = i === last;
        return (
          <span
            key={ticks[i]!.level}
            data-active={open ? 'true' : undefined}
            style={{ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)` }}
            className={`absolute left-0 top-0 flex items-center justify-center rounded-full border font-semibold shadow-sm ${
              open
                ? 'h-6 min-w-6 border-primary bg-primary px-1.5 text-sm text-primary-content'
                : dots
                  ? 'h-1.5 w-1.5 border-base-content/40 bg-base-100'
                  : 'h-4 min-w-4 border-base-content/30 bg-base-100 px-1 text-[10px] leading-none text-base-content'
            }`}
          >
            {open || !dots ? ticks[i]!.name : null}
          </span>
        );
      })}
    </div>
  );
}
