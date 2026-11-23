import { useEffect, useRef, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import { X } from 'lucide-react';
import { isoDzi, isoMapBase, isoSeason } from '../../../data/map/isoMap';
import { isoMinZoom, isoOpeningView } from '../../../data/map/isoView';
import { frameBuilding } from '../../../data/map/isoFloors';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { getMapInstance } from '../mapInstance';
import { logError } from '../../../utils/reportError';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useEscapeLayer } from '../../../hooks/ui/useEscapeLayer';
import { useVisibleMapEvents } from '../../../hooks/useVisibleMapEvents';
import { IsoEventPins } from './IsoEventPins';
import { IsoEventCard } from './IsoEventCard';
import { IsoBuildingLabels } from './IsoBuildingLabels';
import { IsoFloorLayer } from './IsoFloorLayer';
import { IsoFloorRuler } from './IsoFloorRuler';
import { useModalFocus } from './useModalFocus';
import { FloorStack } from '../FloorStack';

/**
 * The isometric campus map, full-bleed over the map screen: pan with a finger or
 * the mouse, pinch or wheel to zoom. OpenSeadragon is imported when this opens,
 * so a build with the prototype off never loads it (and the content script never
 * sees it). The tiles come from `isoMapBase()`; nothing here knows where they live.
 *
 * It is an overlay, not a route, so it closes itself on everything that would
 * otherwise leave it stranded: Escape, Android's back (`mobile/backButton.ts`),
 * the map screen unmounting (the open flag lives in the store and would outlive
 * it), and a "show on map" request, whose target would otherwise land underneath.
 */
/**
 * `clearNav`: the phone's floating bottom nav sits over the map, so the credit line rides above it.
 * `closable` is false only on the standalone demo page, where the picture is the whole page and
 * there is no map underneath to go back to: no Close button, and Escape does nothing.
 */
export function IsoMapView({
  clearNav = false,
  closable = true,
}: {
  clearNav?: boolean;
  closable?: boolean;
}) {
  const open = useAppStore((s) => s.isoMapOpen);
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  // The flag is global; whichever screen hosted the overlay going away must not leave it set.
  useEffect(() => () => setOpen(false), [setOpen]);
  const base = isoMapBase();
  if (!open || base === null) return null;
  return <Viewer base={base} clearNav={clearNav} closable={closable} />;
}

function Viewer({
  base,
  clearNav,
  closable,
}: {
  base: string;
  clearNav: boolean;
  closable: boolean;
}) {
  const { t } = useTranslation();
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  const focusRequest = useAppStore((s) => s.mapFocusRequest);
  const firstFocusRequest = useRef(focusRequest);
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // The viewer, once it exists, for the layers drawn over it (event pins).
  const [engine, setEngine] = useState<{
    viewer: OpenSeadragon.Viewer;
    osd: typeof OpenSeadragon;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // False until the first tile has loaded: before that the host is an empty grey box.
  const [drawn, setDrawn] = useState(false);
  const inBuilding = useAppStore((s) => s.activeBuildingId !== null);
  const events = useVisibleMapEvents();
  const selected = events.find((e) => e.id === selectedId) ?? null;

  useEscapeLayer(closable, () => setOpen(false));

  // A "show on map" (a lesson's room, an event) moves the map under us: step aside so it is seen.
  useEffect(() => {
    if (closable && focusRequest !== firstFocusRequest.current) setOpen(false);
  }, [closable, focusRequest, setOpen]);

  useModalFocus(root, closeButton);

  useEffect(() => {
    let viewer: { destroy: () => void } | null = null;
    let cancelled = false;
    import('openseadragon')
      .then(({ default: OpenSeadragon }) => {
        if (cancelled || !host.current) return;
        const v = new OpenSeadragon.Viewer({
          element: host.current,
          tileSources: isoDzi(base, isoSeason()),
          showNavigationControl: false,
          // A click is not a zoom: a tap that ends a pan or lands on a building would jump a level.
          gestureSettingsMouse: { clickToZoom: false },
          gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true },
          // The picture always covers the screen: no empty space to zoom out into or pan off to.
          // (The zoom-out floor itself depends on the screen's shape; it is set on open and on resize.)
          visibilityRatio: 1,
          constrainDuringPan: true,
          // Past 2 CSS px per image pixel there is nothing more to see, only blur.
          maxZoomPixelRatio: 2,
          animationTime: 0.6,
          immediateRender: false,
        });
        viewer = v;
        setEngine({ viewer: v, osd: OpenSeadragon });
        const onDrawn = () => {
          v.removeHandler('tile-loaded', onDrawn);
          setDrawn(true);
        };
        // `tile-drawn` is raised for the canvas and HTML drawers only, not the WebGL one.
        v.addHandler('tile-loaded', onDrawn);
        const fitZoomFloor = () => {
          // A live setting on the viewport (getMinZoom reads it) that the typings leave out.
          (v.viewport as unknown as { minZoomLevel: number }).minZoomLevel = isoMinZoom(
            v.container.clientWidth,
            v.container.clientHeight
          );
          v.viewport.applyConstraints(true);
        };
        // Open where the 2D map was looking, at about its scale, so the student's place is kept;
        // on the campus when that is off the picture. Then pan and zoom from there.
        v.addHandler('open', () => {
          fitZoomFloor();
          const map = getMapInstance();
          const c = map?.getCenter();
          // With a building's floors open in the 2D map, the whole building is the view.
          const open = useAppStore.getState().activeBuildingId;
          const building = (buildingsJson as BuildingsMeta).buildings.find((b) => b.id === open);
          const start = building
            ? frameBuilding(building, v.container.clientWidth / v.container.clientHeight)
            : isoOpeningView(
                map && c ? { lat: c.lat, lng: c.lng, zoom: map.getZoom() } : null,
                v.container.clientWidth
              );
          v.viewport.zoomTo(Math.max(start.zoom, v.viewport.getMinZoom()), undefined, true);
          v.viewport.panTo(new OpenSeadragon.Point(start.x, start.y), true);
          v.viewport.applyConstraints(true);
        });
        v.addHandler('resize', fitZoomFloor);
      })
      .catch((err: unknown) => {
        logError('IsoMapView.load', err);
        // An opaque dialog over an empty host is worse than no dialog: give the working map back.
        if (!cancelled) setOpen(false);
      });
    return () => {
      cancelled = true;
      viewer?.destroy();
      setEngine(null);
    };
  }, [base, setOpen]);

  return (
    <div
      ref={root}
      data-testid="iso-map"
      role="dialog"
      aria-modal="true"
      aria-label={t('map.isoTitle')}
      className="absolute inset-0 z-[1002] bg-base-300"
    >
      <div ref={host} className="absolute inset-0" />
      {!drawn && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 grid place-items-center text-base-content/70"
        >
          <span className="flex flex-col items-center gap-2 text-sm">
            <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
            {t('map.isoLoading')}
          </span>
        </div>
      )}
      {engine && <IsoFloorLayer viewer={engine.viewer} osd={engine.osd} />}
      {engine && <IsoBuildingLabels viewer={engine.viewer} osd={engine.osd} />}
      {engine && inBuilding && <IsoFloorRuler viewer={engine.viewer} osd={engine.osd} />}
      {inBuilding && (
        <div className="absolute right-3 top-1/2 z-[1] -translate-y-1/2">
          <FloorStack size="sm" />
        </div>
      )}
      {engine && (
        <IsoEventPins
          viewer={engine.viewer}
          osd={engine.osd}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
      {selected && (
        <IsoEventCard event={selected} clearNav={clearNav} onClose={() => setSelectedId(null)} />
      )}
      {closable && (
        <button
          ref={closeButton}
          type="button"
          data-testid="iso-map-close"
          aria-label={t('map.isoClose')}
          onClick={() => setOpen(false)}
          className="btn btn-circle btn-sm absolute right-3 top-[calc(0.75rem_+_var(--safe-top,0px))] bg-base-100 shadow-popover-heavy"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      {/* Top left, level with the close button: the bottom is the nav bar's and the event pins', and this sat on the map. */}
      <p className="absolute left-3 top-[calc(0.75rem_+_var(--safe-top,0px))] flex h-8 items-center rounded bg-base-100/80 px-2 text-xs">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="link-hover link"
        >
          {t('map.isoCredit')}
        </a>
      </p>
    </div>
  );
}
