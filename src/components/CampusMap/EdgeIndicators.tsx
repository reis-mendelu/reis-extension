import { useEffect, useState } from 'react';
import type L from 'leaflet';
import landmarksJson from '../../data/map/landmarks.json';
import type { Landmark } from '../../types/campusMap';
import { useAppStore } from '../../store/useAppStore';
import { polygonCentroid } from './mapHelpers';
import { clusterLandmarks, edgeAnchor } from './edgeIndicator';
import { subscribeMapInstance } from './mapInstance';

const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const CLUSTERS = clusterLandmarks(
  LANDMARKS.map((l) => {
    const [lon, lat] = polygonCentroid(l.outline.coordinates[0]);
    return { id: l.id, name: l.name, lat, lon };
  }),
  150,
);

interface Arrow { key: string; x: number; y: number; deg: number; label: string; firstId: number; }
const PAD = 28;

export function EdgeIndicators() {
  const focusLandmarkById = useAppStore((s) => s.focusLandmarkById);
  const [arrows, setArrows] = useState<Arrow[]>([]);

  useEffect(() => {
    let map: L.Map | null = null;
    let rafId: number | null = null;
    const recompute = () => {
      if (!map) { setArrows([]); return; }
      const size = map.getSize();
      const rect = { width: size.x, height: size.y };
      const center = { x: size.x / 2, y: size.y / 2 };
      const next: Arrow[] = [];
      for (const c of CLUSTERS) {
        const pt = map.latLngToContainerPoint([c.lat, c.lon]);
        const a = edgeAnchor(center, { x: pt.x, y: pt.y }, rect, PAD);
        if (!a) continue;
        // ▲ glyph points up (= -y). atan2 gives the screen-space heading; +90°
        // rotates the up-glyph onto it.
        next.push({ key: c.ids.join('-'), x: a.x, y: a.y, deg: (a.angle * 180) / Math.PI + 90, label: c.label, firstId: c.ids[0] });
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
    const bind = (m: L.Map) => { m.on('moveend zoomend', recompute); scheduleRecompute(); };
    const unbind = (m: L.Map) => { m.off('moveend zoomend', recompute); };
    const unsub = subscribeMapInstance((m) => {
      if (map) unbind(map);
      map = m;
      if (map) bind(map);
      else scheduleRecompute();
    });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (map) unbind(map);
      unsub();
    };
  }, []);

  if (arrows.length === 0) return null;
  return (
    <div className="absolute inset-0 z-[900] pointer-events-none">
      {arrows.map((a) => (
        <button
          key={a.key}
          className="btn btn-xs btn-circle btn-secondary absolute pointer-events-auto shadow"
          style={{ left: a.x, top: a.y, transform: 'translate(-50%, -50%)' }}
          title={a.label}
          onClick={() => focusLandmarkById(a.firstId)}
        >
          <span style={{ transform: `rotate(${a.deg}deg)` }}>▲</span>
        </button>
      ))}
    </div>
  );
}
