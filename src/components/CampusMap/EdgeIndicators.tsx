import { useEffect, useRef, useState, type RefObject } from 'react';
import type L from 'leaflet';
import landmarksJson from '../../data/map/landmarks.json';
import buildingsJson from '../../data/map/buildings.json';
import type { Landmark, BuildingsMeta } from '../../types/campusMap';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { polygonCentroid } from './mapHelpers';
import { clusterLandmarks, edgeAnchor, nudgePastBoxes, type Box } from './edgeIndicator';
import { subscribeMapInstance } from './mapInstance';

const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const [CAMPUS_LAT, CAMPUS_LON] = (buildingsJson as BuildingsMeta).campus.center;
const CLUSTERS = clusterLandmarks(
  LANDMARKS.map((l) => {
    const [lon, lat] = polygonCentroid(l.outline.coordinates[0]);
    return { id: l.id, name: l.name, lat, lon };
  }),
  150,
);

// Every off-screen destination an arrow can point to: the landmark clusters plus
// the main campus itself (so panning far away still leaves a way back). Campus is
// flagged so its click and (translated) label differ from the landmark arrows.
interface Target { key: string; lat: number; lon: number; label: string; firstId: number; isCampus: boolean; }
const TARGETS: Target[] = [
  ...CLUSTERS.map((c) => ({ key: c.ids.join('-'), lat: c.lat, lon: c.lon, label: c.label, firstId: c.ids[0], isCampus: false })),
  { key: 'campus', lat: CAMPUS_LAT, lon: CAMPUS_LON, label: '', firstId: -1, isCampus: true },
];

interface Arrow { key: string; x: number; y: number; deg: number; angle: number; label: string; firstId: number; isCampus: boolean; }
const PAD = 28;
const LABEL_OFFSET = 26; // px the label sits inward (toward centre) from the arrow

/** Refs to the on-map panels (search/floors top-left, Místa top-right) so edge
 *  arrows can slide out from behind them instead of disappearing. */
interface EdgeIndicatorsProps { occluders?: RefObject<HTMLElement | null>[]; }

export function EdgeIndicators({ occluders = [] }: EdgeIndicatorsProps) {
  const focusLandmarkById = useAppStore((s) => s.focusLandmarkById);
  const focusCampus = useAppStore((s) => s.focusCampus);
  const { t } = useTranslation();
  const [arrows, setArrows] = useState<Arrow[]>([]);
  // Keep the latest occluder refs reachable from the mount-once effect without
  // re-subscribing to the map on every render. A panel opening/closing (e.g. the
  // detail panel) changes the occluders but fires no map event, so also nudge a
  // recompute whenever they change — otherwise arrows stay stale behind the new
  // panel until the user pans/zooms.
  const scheduleRecomputeRef = useRef<(() => void) | null>(null);
  const occludersRef = useRef(occluders);
  useEffect(() => {
    occludersRef.current = occluders;
    scheduleRecomputeRef.current?.();
  }, [occluders]);

  useEffect(() => {
    let map: L.Map | null = null;
    let rafId: number | null = null;
    const recompute = () => {
      if (!map) { setArrows([]); return; }
      const size = map.getSize();
      const rect = { width: size.x, height: size.y };
      const center = { x: size.x / 2, y: size.y / 2 };
      // Panel rectangles in container-relative px, so an arrow caught behind one
      // can be slid clear (keeps arrows at the true screen edge, not inset).
      const base = map.getContainer().getBoundingClientRect();
      const boxes: Box[] = occludersRef.current
        .map((r) => r.current?.getBoundingClientRect())
        .filter((b): b is DOMRect => b != null)
        .map((b) => ({ left: b.left - base.left, top: b.top - base.top, right: b.right - base.left, bottom: b.bottom - base.top }));
      const next: Arrow[] = [];
      for (const target of TARGETS) {
        const pt = map.latLngToContainerPoint([target.lat, target.lon]);
        const a = edgeAnchor(center, { x: pt.x, y: pt.y }, rect, PAD);
        if (!a) continue;
        const { x, y } = nudgePastBoxes({ x: a.x, y: a.y }, boxes, rect.height, PAD);
        // ▲ glyph points up (= -y). atan2 gives the screen-space heading; +90°
        // rotates the up-glyph onto it.
        next.push({ key: target.key, x, y, deg: (a.angle * 180) / Math.PI + 90, angle: a.angle, label: target.label, firstId: target.firstId, isCampus: target.isCampus });
      }
      setArrows(next);
    };
    // Calling setState synchronously during this effect's own execution (e.g.
    // from subscribeMapInstance's immediate replay callback) trips
    // react-hooks' "no cascading renders" rule. Defer that initial/subscribe
    // compute to a animation frame; moveend/zoomend fire later from real user
    // input so they may call recompute directly.
    const scheduleRecompute = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; recompute(); });
    };
    scheduleRecomputeRef.current = scheduleRecompute;
    const bind = (m: L.Map) => { m.on('moveend zoomend', recompute); scheduleRecompute(); };
    const unbind = (m: L.Map) => { m.off('moveend zoomend', recompute); };
    const unsub = subscribeMapInstance((m) => {
      if (map) unbind(map);
      map = m;
      if (map) bind(map);
      else scheduleRecompute();
    });
    return () => {
      scheduleRecomputeRef.current = null;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (map) unbind(map);
      unsub();
    };
  }, []);

  if (arrows.length === 0) return null;
  return (
    <div className="absolute inset-0 z-[900] pointer-events-none">
      {arrows.map((a) => {
        const label = a.isCampus ? t('map.mainCampus') : a.label;
        const go = a.isCampus ? () => focusCampus() : () => focusLandmarkById(a.firstId);
        // Place the label inward from the arrow and grow it away from the edge so
        // it stays on-screen: target to the right → arrow on the right edge → label
        // to its left; near-vertical edges centre the label.
        const lx = a.x - Math.cos(a.angle) * LABEL_OFFSET;
        const ly = a.y - Math.sin(a.angle) * LABEL_OFFSET;
        const h = Math.cos(a.angle);
        const labelTx = h > 0.3 ? '-100%' : h < -0.3 ? '0' : '-50%';
        return (
          <div key={a.key}>
            {/* Soft (not stark) solid green so it reads on the light basemap
                without shouting; the global soft-button tint was invisible. */}
            <button
              className="absolute pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-white/70"
              style={{ left: a.x, top: a.y, transform: 'translate(-50%, -50%)', backgroundColor: '#8bc34a' }}
              title={label}
              onClick={go}
            >
              <span className="text-xs leading-none" style={{ transform: `rotate(${a.deg}deg)` }}>▲</span>
            </button>
            <button
              className="absolute pointer-events-auto max-w-[140px] truncate rounded-full border border-base-300 bg-base-100/95 px-2 py-0.5 text-xs font-medium text-base-content shadow-sm"
              style={{ left: lx, top: ly, transform: `translate(${labelTx}, -50%)` }}
              title={label}
              onClick={go}
            >
              {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
