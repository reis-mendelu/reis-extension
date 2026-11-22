import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  ISO_ATTRIBUTION,
  ISO_START,
  isoDzi,
  isoMapBase,
  isoSeason,
} from '../../../data/map/isoMap';
import { logError } from '../../../utils/reportError';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * The isometric campus map, full-bleed over the map screen: pan with a finger or
 * the mouse, pinch or wheel to zoom. OpenSeadragon is imported when this opens,
 * so a build with the prototype off never loads it (and the content script never
 * sees it). The tiles come from `isoMapBase()`; nothing here knows where they live.
 */
/** `clearNav`: the phone's floating bottom nav sits over the map, so the credit line rides above it. */
export function IsoMapView({ clearNav = false }: { clearNav?: boolean }) {
  const open = useAppStore((s) => s.isoMapOpen);
  const base = isoMapBase();
  if (!open || base === null) return null;
  return <Viewer base={base} clearNav={clearNav} />;
}

function Viewer({ base, clearNav }: { base: string; clearNav: boolean }) {
  const { t } = useTranslation();
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  const host = useRef<HTMLDivElement>(null);

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
          gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true },
          visibilityRatio: 0.6,
          minZoomImageRatio: 0.9,
          maxZoomPixelRatio: 3,
          animationTime: 0.6,
          immediateRender: false,
        });
        viewer = v;
        // Open on the campus (building Q) rather than the whole city; pan and zoom from there.
        v.addHandler('open', () => {
          v.viewport.zoomTo(ISO_START.zoom, undefined, true);
          v.viewport.panTo(new OpenSeadragon.Point(ISO_START.x, ISO_START.y), true);
        });
      })
      .catch((err: unknown) => logError('IsoMapView.load', err));
    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [base]);

  return (
    <div data-testid="iso-map" className="absolute inset-0 z-[1002] bg-base-300">
      <div ref={host} className="absolute inset-0" role="img" aria-label={t('map.isoTitle')} />
      <button
        type="button"
        data-testid="iso-map-close"
        aria-label={t('map.isoClose')}
        onClick={() => setOpen(false)}
        className="btn btn-circle btn-sm absolute right-3 top-[calc(0.75rem_+_var(--safe-top,0px))] bg-base-100 shadow-popover-heavy"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <p
        className={`pointer-events-none absolute left-3 rounded bg-base-100/80 px-2 py-0.5 text-[11px] ${clearNav ? 'bottom-[calc(5.5rem_+_var(--safe-bottom,0px))]' : 'bottom-2'}`}
      >
        {ISO_ATTRIBUTION}
      </p>
    </div>
  );
}
