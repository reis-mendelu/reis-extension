import { Box } from 'lucide-react';
import { isoMapEnabled } from '../../../data/map/isoMap';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIsoMapReachable } from './useIsoMapReachable';

/**
 * Opens the isometric campus map over the map. Renders nothing unless the
 * prototype is switched on (VITE_ISO_MAP_URL). Shared by the phone's MapScreen
 * and the desktop's CampusMapView; the caller only places it. Disabled, with the
 * reason as its label, while the 2D map looks somewhere the picture does not reach.
 */
export function IsoMapButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const setOpen = useAppStore((s) => s.setIsoMapOpen);
  const reachable = useIsoMapReachable();
  if (!isoMapEnabled()) return null;
  return (
    <button
      type="button"
      data-testid="iso-map-open"
      aria-label={reachable ? t('map.isoOpen') : t('map.isoOffCampus')}
      title={reachable ? undefined : t('map.isoOffCampus')}
      disabled={!reachable}
      onClick={() => setOpen(true)}
      className={`btn btn-circle btn-sm bg-base-100 shadow-popover-heavy disabled:opacity-60 ${className}`}
    >
      <Box size={16} aria-hidden="true" />
    </button>
  );
}
