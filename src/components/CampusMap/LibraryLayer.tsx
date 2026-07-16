import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import { computeNextSlot } from '../../services/library/nextSlot';
import { subscribeMapInstance } from './mapInstance';

// Centroid of the Knihovna A cluster (building A), as [lng, lat].
const LIBRARY_COORD: [number, number] = [16.6152, 49.20996];
// The Team Study Room 1 code that focusRoomByCode flies to on click — building
// A / floor -1, from which the student can see the whole library zone and pick
// any room.
const LIBRARY_FOCUS_CODE = 'BA01P1049';

// Leaflet's private projection used by its own markers to animate on zoom.
type ZoomAnimMap = {
  _latLngToNewLayerPoint(
    latlng: L.LatLngExpression,
    zoom: number,
    center: L.LatLngExpression
  ): L.Point;
};

// Mirrors EventLayer's projection mechanism (see that file for the full
// rationale): an HTML pin portalled into the shared `reisEvents` Leaflet pane
// so it rides pans for free and animates in sync with the basemap on zoom.
// This layer projects a single fixed point (the library), not a data-driven
// set of pins, so it needs no re-place-on-data-change bookkeeping.
export function LibraryLayer() {
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const availability = useAppStore((s) => s.libraryAvailability);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const { t } = useTranslation();
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let map: L.Map | null = null;
    // Zoom at which `pt` was last computed — lets the `move` handler tell a
    // pure pan (zoom unchanged → pane rides the transform, skip) apart from a
    // fly's continuous zoom change (recompute each frame so the pin stays
    // glued), same as EventLayer.
    let placedZoom = NaN;
    const recompute = () => {
      if (!map) {
        setPt(null);
        return;
      }
      placedZoom = map.getZoom();
      const p = map.latLngToLayerPoint([LIBRARY_COORD[1], LIBRARY_COORD[0]]);
      setPt({ x: p.x, y: p.y });
    };
    const onMove = () => {
      if (map && map.getZoom() !== placedZoom) recompute();
    };
    const onZoomAnim = (e: L.ZoomAnimEvent) => {
      if (!map) return;
      const proj = map as unknown as ZoomAnimMap;
      const p = proj
        ._latLngToNewLayerPoint([LIBRARY_COORD[1], LIBRARY_COORD[0]], e.zoom, e.center)
        .round();
      setPt({ x: p.x, y: p.y });
    };
    const bind = (m: L.Map) => {
      const p = m.getPane('reisEvents') ?? m.createPane('reisEvents');
      p.style.zIndex = '640';
      p.style.pointerEvents = 'none';
      setPane(p);
      m.on('zoomanim', onZoomAnim);
      m.on('move', onMove);
      m.on('zoomend viewreset', recompute);
      recompute();
    };
    const unbind = (m: L.Map) => {
      m.off('zoomanim', onZoomAnim);
      m.off('move', onMove);
      m.off('zoomend viewreset', recompute);
    };
    const unsub = subscribeMapInstance((m) => {
      if (map) unbind(map);
      map = m;
      if (map) bind(map);
      else {
        setPane(null);
        setPt(null);
      }
    });
    return () => {
      if (map) unbind(map);
      unsub();
    };
  }, []);

  if (activeBuildingId !== null || !pane || !pt) return null;

  const now = new Date();
  const freeCount = LIBRARY_ROOMS.filter((room) => {
    const a = availability[room.staffGuid];
    return a ? computeNextSlot(a.blocks, room.leadMinutes, now) !== null : false;
  }).length;

  return createPortal(
    <button
      type="button"
      className="pointer-events-auto absolute left-0 top-0 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-content leaflet-zoom-animated"
      style={{ transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)` }}
      onClick={() => focusRoomByCode(LIBRARY_FOCUS_CODE)}
    >
      {t('map.title')} · {t('map.libraryFreeToday', { count: freeCount })}
    </button>,
    pane
  );
}
