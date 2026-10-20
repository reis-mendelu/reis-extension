import { useSyncExternalStore } from 'react';
import L from 'leaflet';
import { MapPinOff } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  getOsmTileAccess,
  requestOsmTileAccess,
  subscribeOsmTileAccess,
} from '../../utils/osmTileAccess';
import { getMapInstance } from './mapInstance';

/**
 * The extension's one-click way back to a working basemap.
 *
 * Shown whenever the browser has not let reIS name itself on OpenStreetMap
 * tile requests: always in Firefox until granted, in Chrome only when site
 * access was withheld. Not on whether tiles are blocked right now — OSM's 403
 * is an image that still fires `load`, so the page cannot tell. The phone apps
 * have no permissions API and never render it (see the guard
 * phoneHasNoOsmTileBanner.test.ts).
 */
export function OsmTileAccessBanner() {
  const access = useSyncExternalStore(subscribeOsmTileAccess, getOsmTileAccess);
  const { t } = useTranslation();
  if (access !== 'missing') return null;

  const allow = () => {
    // First, before any await: Firefox honours the request only inside the click.
    void requestOsmTileAccess().then((ok) => {
      if (!ok) return;
      // Tiles already on screen went out anonymous; fetch them again, named.
      getMapInstance()?.eachLayer((l) => {
        if (l instanceof L.TileLayer) l.redraw();
      });
    });
  };

  return (
    <div className="alert alert-warning flex w-96 max-w-[calc(100vw-1.5rem)] items-start gap-3 shadow-popover-heavy">
      <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('map.osmAccess.title')}</span>
        <span className="text-sm">{t('map.osmAccess.text')}</span>
        <button type="button" onClick={allow} className="btn btn-sm btn-neutral self-start">
          {t('map.osmAccess.allow')}
        </button>
      </div>
    </div>
  );
}
