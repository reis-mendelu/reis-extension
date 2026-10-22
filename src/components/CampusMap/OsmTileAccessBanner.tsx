import { MapPinOff } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { requestOsmTileAccess } from '../../utils/osmTileAccess';

/**
 * The extension's one-click way back to a working basemap.
 *
 * Shown whenever the browser has not let reIS name itself on OpenStreetMap
 * tile requests: always in Firefox until granted, in Chrome only when site
 * access was withheld. Not on whether tiles are blocked right now — OSM's 403
 * is an image that still fires `load`, so the page cannot tell.
 *
 * On both map trees, because the extension renders the phone tree too (Firefox
 * for Android, a narrow touch window). The apps have no permissions API, so
 * the watcher reports `unsupported` there and this renders nothing.
 */
export function OsmTileAccessBanner({ className = 'w-96 max-w-[calc(100vw-1.5rem)]' }) {
  const access = useAppStore((s) => s.osmTileAccess);
  const setAccess = useAppStore((s) => s.setOsmTileAccess);
  const { t } = useTranslation();
  if (access !== 'missing') return null;

  const allow = () => {
    // First, before any await: Firefox honours the request only inside the click.
    // The slice redraws the tiles on the way to `granted`.
    void requestOsmTileAccess().then((ok) => ok && setAccess('granted'));
  };

  return (
    <div className={`alert alert-warning flex items-start gap-3 shadow-popover-heavy ${className}`}>
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
