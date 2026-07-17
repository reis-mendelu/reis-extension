import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import { Library } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import { isBookableToday } from '../../services/library/nextSlot';
import { subscribeMapInstance } from './mapInstance';

// Centroid of the Knihovna A cluster (building A), as [lng, lat].
const LIBRARY_COORD: [number, number] = [16.6152, 49.20996];

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
  const openLibraryOverview = useAppStore((s) => s.openLibraryOverview);
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
    return a ? isBookableToday(a.blocks, room.leadMinutes, now) : false;
  }).length;
  // Availability not loaded (or partially failed) for some room → never make a
  // definitive "fully booked" claim; show the neutral free-note instead.
  const hasUnknown = LIBRARY_ROOMS.some((room) => !availability[room.staffGuid]);
  const hoverText =
    freeCount > 0
      ? t('map.libraryFreeToday', { count: freeCount })
      : hasUnknown
        ? t('map.libraryFreeNote')
        : t('map.libraryFull');

  // A map-native marker in the same visual language as the society event pins:
  // a small white disc anchored on the library building, carrying the library
  // glyph — no persistent label (that surfaces on hover). A count badge appears
  // only when rooms are free today, so the marker reads "alive" without shouting.
  return createPortal(
    <button
      type="button"
      aria-label={`${t('map.studyRooms')} — ${hoverText}`}
      className="group pointer-events-auto absolute left-0 top-0 flex items-center justify-center leaflet-zoom-animated"
      style={{ transform: `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)` }}
      onClick={() => openLibraryOverview()}
    >
      {/* Fixed white/black literals (not theme tokens): map overlays sit on the
          always-light basemap, same as EventPin. */}
      <span className="relative flex size-[30px] items-center justify-center rounded-full border border-black/10 bg-white shadow-md transition-transform group-hover:scale-110">
        <Library size={17} strokeWidth={2} className="text-primary" aria-hidden="true" />
        {freeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold leading-none text-success-content shadow-sm tabular-nums">
            {freeCount}
          </span>
        )}
        <span className="pointer-events-none absolute bottom-[38px] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100 px-2 py-1 text-base-content shadow-popover-heavy group-hover:block">
          <span className="block text-[11px] font-bold leading-tight">{t('map.studyRooms')}</span>
          <span className="block text-[10px] font-semibold leading-tight text-base-content/60">
            {hoverText}
          </span>
        </span>
      </span>
    </button>,
    pane
  );
}
