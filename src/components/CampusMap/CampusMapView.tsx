import { useEffect, useRef } from 'react';
import { MapCanvas } from './MapCanvas';
import { FloorStack } from './FloorStack';
import { MapSidePanel } from './MapSidePanel';
import { DetailPanel } from './DetailPanel';
import { RoomSearch } from './RoomSearch';
import { EdgeIndicators } from './EdgeIndicators';
import { EventLayer } from './EventLayer';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function CampusMapView() {
  const selection = useAppStore((s) => s.mapSelection);
  const placing = useAppStore((s) => s.placingEvent);
  const cancelPlacing = useAppStore((s) => s.cancelPlacing);
  const loadLibraryAvailability = useAppStore((s) => s.loadLibraryAvailability);
  const { t } = useTranslation();
  // Store-load orchestration (not component-level data fetching): kick off the
  // library room availability fetch once when the map mounts.
  useEffect(() => {
    void loadLibraryAvailability();
  }, [loadLibraryAvailability]);
  // Edge arrows slide out from behind these panels instead of vanishing.
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const placesPanelRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  // `isolate` (isolation: isolate) confines Leaflet's internal panes/controls
  // and our z-[1000] overlays to this subtree's stacking context. Without it
  // those high z-indexes escape to the root and paint OVER app drawers/popovers
  // (eduroam, student popover — both z-50). See CampusMap layering notes.
  return (
    <div className="relative isolate w-full h-full">
      <MapCanvas />
      <EventLayer />
      <EdgeIndicators occluders={[leftPanelRef, placesPanelRef, detailPanelRef]} />
      {/* Floor selector moved off the right edge (it overlapped the Místa panel)
          into the left column under the search. */}
      <div
        ref={leftPanelRef}
        className="absolute top-3 left-3 z-[1000] flex flex-col items-start gap-2"
      >
        <RoomSearch />
        <FloorStack />
      </div>
      <div ref={placesPanelRef} className="absolute top-3 right-3 z-[1000]">
        <MapSidePanel />
      </div>
      {selection && (
        <div ref={detailPanelRef} className="absolute bottom-3 left-3 z-[1000] w-72">
          <DetailPanel />
        </div>
      )}
      {placing && (
        <div className="absolute bottom-6 left-1/2 z-[1001] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-2 text-primary-content shadow-popover-heavy">
          <span className="text-sm font-semibold">{t('map.clickToPlace')}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={cancelPlacing}>
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
