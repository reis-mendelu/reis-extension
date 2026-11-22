import { Box } from 'lucide-react';
import { isoMapEnabled } from '../../../data/map/isoMap';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Opens the isometric campus map over the map. Renders nothing unless the
 * prototype is switched on (VITE_ISO_MAP_URL). Shared by the phone's MapScreen
 * and the desktop's CampusMapView; the caller only places it.
 */
export function IsoMapButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  if (!isoMapEnabled()) return null;
  return (
    <button
      type="button"
      data-testid="iso-map-open"
      aria-label={t('map.isoOpen')}
      onClick={() => setOpen(true)}
      className={`btn btn-circle btn-sm bg-base-100 shadow-popover-heavy ${className}`}
    >
      <Box size={16} aria-hidden="true" />
    </button>
  );
}
