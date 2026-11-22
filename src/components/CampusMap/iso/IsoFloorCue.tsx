import { useCallback, useEffect, useMemo, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { IMG } from '../../../data/map/isoView';
import { cueText, floorCue } from '../../../data/map/isoFloorCue';

const META = buildingsJson as BuildingsMeta;
type Pt = { x: number; y: number };

/**
 * "4. patro", said on the building itself: a label at the open
 * floor's nearest corner, in the words a student uses. Placed from OpenSeadragon's own viewport on
 * every frame, like the ruler and the event pins, so it keeps its size at any zoom.
 */
export function IsoFloorCue({
  viewer,
  osd,
}: {
  viewer: OpenSeadragon.Viewer;
  osd: typeof OpenSeadragon;
}) {
  const { language } = useTranslation();
  const buildingId = useAppStore((s) => s.activeBuildingId);
  const floorId = useAppStore((s) => s.activeFloorId);
  const cue = useMemo(() => {
    const b = META.buildings.find((x) => x.id === buildingId);
    const level = b?.floors.find((f) => f.id === floorId)?.level;
    return b && level !== undefined ? floorCue(b, level) : null;
  }, [buildingId, floorId]);
  const [at, setAt] = useState<Pt | null>(null);

  const place = useCallback(() => {
    if (!cue) return setAt(null);
    const c = cue.corner;
    setAt(viewer.viewport.pixelFromPoint(new osd.Point(c.px / IMG.w, c.py / IMG.w), true));
  }, [viewer, osd, cue]);

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

  if (!cue || !at) return null;
  const text = cueText(cue.up, language);
  // Room for the label to the corner's left (about 8px a character, plus its padding), else it goes to the right, under the plate.
  const width = text.length * 8 + 20;
  const left = at.x - 20 - width >= 6;
  // With the corner scrolled out of view the label stays on screen, pinned to the edge: it still says which floor is open.
  const [w, h] = [viewer.container.clientWidth, viewer.container.clientHeight];
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const y = clamp(at.y + (left ? 0 : 12), 20, h - 20);
  const x = left ? clamp(at.x - 20, width + 6, w - 6) : clamp(at.x + 20, 6, w - width - 6);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        data-testid="iso-floor-cue"
        data-side={left ? 'left' : 'right'}
        style={{
          transform: left
            ? `translate(${x}px, ${y}px) translate(-100%, -50%)`
            : `translate(${x}px, ${y}px) translate(0, -50%)`,
        }}
        className="absolute left-0 top-0 whitespace-nowrap rounded-lg border border-primary bg-base-100 px-2 py-1 text-xs leading-tight shadow-sm"
      >
        <span className="block text-sm font-semibold first-letter:uppercase">{text}</span>
      </div>
    </div>
  );
}
