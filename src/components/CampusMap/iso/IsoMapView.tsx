import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { isoDzi, isoMapBase, isoSeason } from '../../../data/map/isoMap';
import { isoMinZoom, isoOpeningView } from '../../../data/map/isoView';
import { getMapInstance } from '../mapInstance';
import { logError } from '../../../utils/reportError';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useEscapeLayer } from '../../../hooks/ui/useEscapeLayer';

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
/** `clearNav`: the phone's floating bottom nav sits over the map, so the credit line rides above it. */
export function IsoMapView({ clearNav = false }: { clearNav?: boolean }) {
  const open = useAppStore((s) => s.isoMapOpen);
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  // The flag is global; whichever screen hosted the overlay going away must not leave it set.
  useEffect(() => () => setOpen(false), [setOpen]);
  const base = isoMapBase();
  if (!open || base === null) return null;
  return <Viewer base={base} clearNav={clearNav} />;
}

function Viewer({ base, clearNav }: { base: string; clearNav: boolean }) {
  const { t } = useTranslation();
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  const focusRequest = useAppStore((s) => s.mapFocusRequest);
  const firstFocusRequest = useRef(focusRequest);
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEscapeLayer(true, () => setOpen(false));

  // A "show on map" (a lesson's room, an event) moves the map under us: step aside so it is seen.
  useEffect(() => {
    if (focusRequest !== firstFocusRequest.current) setOpen(false);
  }, [focusRequest, setOpen]);

  // Modal: what is behind is out of reach of Tab and of screen readers; focus goes to Close and,
  // on close, back to whatever opened us.
  useEffect(() => {
    const el = root.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = el?.parentElement
      ? Array.from(el.parentElement.children).filter((c): c is HTMLElement => c !== el)
      : [];
    const wasInert = siblings.map((c) => c.inert);
    siblings.forEach((c) => (c.inert = true));
    closeButton.current?.focus();
    // Tab stays in the dialog: it wraps at both ends, and focus that has strayed out (a click on the
    // nav, which stays reachable by pointer so a student can leave the map) is pulled back in.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const at = document.activeElement;
      // A dialog opened over the map (the critical-update pop-up after a resume) owns Tab while
      // focus is in it; pulling focus back here would lock a keyboard user out of its buttons.
      const other =
        at instanceof Element ? at.closest('[role="dialog"], [role="alertdialog"]') : null;
      if (other && other !== el) return;
      if (!el.contains(at) || (e.shiftKey && at === first) || (!e.shiftKey && at === last)) {
        e.preventDefault();
        (e.shiftKey && el.contains(at) ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach((c, i) => (c.inert = wasInert[i] ?? false));
      if (opener?.isConnected) opener.focus();
    };
  }, []);

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
          const start = isoOpeningView(
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
      <p
        className={`absolute left-3 rounded bg-base-100/80 px-2 py-1 text-xs ${clearNav ? 'bottom-[calc(5.5rem_+_var(--safe-bottom,0px))]' : 'bottom-2'}`}
      >
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
