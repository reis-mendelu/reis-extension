import { MapCanvas } from '../CampusMap/MapCanvas';
import { EventLayer } from '../CampusMap/EventLayer';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// The console's map pane. Same canvas and pin layer as the student map — with
// `adminConsoleOpen` set, EventLayer draws the active society's own events
// (scheduled ones included) instead of the public feed.
//
// No DetailPanel here on purpose: that card is the student's read surface, with
// RSVP and directions on it. In the console the list column is the detail view,
// and a selected pin just highlights its row.
//
// `isolate` confines Leaflet's panes and our z-[1000] overlays to this subtree,
// the same reason CampusMapView carries it.
export function AdminConsoleMap() {
  const placing = useAppStore((s) => s.placingEvent);
  const cancelPlacing = useAppStore((s) => s.cancelPlacing);
  const { t } = useTranslation();

  return (
    <div className="relative isolate h-full w-full">
      <MapCanvas />
      <EventLayer />
      {placing && (
        <div className="absolute bottom-6 left-1/2 z-[1001] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-2 text-primary-content shadow-popover-heavy">
          <span className="text-sm font-semibold">{t('map.clickToPlace') as string}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={cancelPlacing}>
            {t('common.cancel') as string}
          </button>
        </div>
      )}
    </div>
  );
}
