import { Search } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { ScreenHeader } from './calendar/ScreenHeader';
import { useAppStore } from '../../../store/useAppStore';
import { MapCanvas } from '../../CampusMap/MapCanvas';
import { EventLayer } from '../../CampusMap/EventLayer';
import { roomLabel } from '../../CampusMap/mapHelpers';
import type { MapSelection } from '../../../types/campusMap';
import { FloorSwitcher } from './map/FloorSwitcher';
import { MapSheet } from './map/MapSheet';

function resultLabel(m: MapSelection): string {
  if (m.kind === 'poi') return m.poi.name;
  if (m.kind === 'roomRef') return roomLabel(m.entry.name, m.entry.code, m.entry.nickname);
  if (m.kind === 'landmark') return m.landmark.name;
  return '';
}

/**
 * Mapa screen: `MapCanvas` (the shared, unmodified Leaflet instance — same
 * component desktop's CampusMapView uses) filling the whole screen, with
 * floating chrome and the bottom sheet layered on top.
 *
 * `MapCanvas` and `MapSheet` are siblings here, not nested — the sheet
 * expanding/collapsing (`mapSheetState`) only changes the sheet's own height;
 * it never unmounts or wraps `MapCanvas`, so Leaflet's instance survives the
 * transition untouched. MapCanvas's own container is `absolute inset-0`
 * against THIS element (sized by the flex-1 layout below, which doesn't
 * change when the sheet toggles), so the Leaflet container's actual pixel
 * size never changes either — `invalidateSize()` is for when a map's
 * container is resized (e.g. a layout reflow), and no such resize happens
 * here, so it isn't called.
 *
 * `isolate` contains Leaflet's own internal control z-indexes (it sets
 * z-index: 1000 on its control container) to this subtree — without it they
 * would otherwise escape and paint over BottomNav / SheetHost at the
 * MobileApp level. See CampusMapView for the desktop equivalent of this note.
 */
export function MapScreen() {
  const { t } = useTranslation();
  const query = useAppStore((s) => s.mapSearchQuery);
  const results = useAppStore((s) => s.mapSearchResults);
  const setQuery = useAppStore((s) => s.setMapSearchQuery);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const focusPoiById = useAppStore((s) => s.focusPoiById);
  const focusLandmarkById = useAppStore((s) => s.focusLandmarkById);

  const selectResult = (m: MapSelection) => {
    if (m.kind === 'poi') focusPoiById(m.poi.id);
    else if (m.kind === 'roomRef') focusRoomByCode(m.entry.code);
    else if (m.kind === 'landmark') focusLandmarkById(m.landmark.id);
    setQuery('');
  };

  return (
    // The header is a solid row ABOVE the canvas rather than floating over it:
    // ScreenHeader carries no background of its own, and four icons plus a
    // title over live map tiles is unreadable. The map gives up that strip.
    <div data-testid="map-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader title={t('mobile.nav.map')} />
      <div className="relative isolate flex flex-1 flex-col overflow-hidden">
        <MapCanvas />
        {/* The society event pins. The sheet's Akce tab has always listed these
          events; without this layer they were listed but never shown on the map
          they name, so a society could publish an event and find no pin for it
          on a student's phone. Same component the desktop map and the admin
          console use — it portals into a Leaflet pane, so it renders nothing
          here and does not affect this element's layout. */}
        <EventLayer />
        <FloorSwitcher />
        {/* No --safe-top here any more: ScreenHeader sits above this bar now and
          carries the inset for the screen, the way it does on every other tab.
          It used to be the topmost element on the map, and a flat mt-4 was the
          bug — under targetSdk 36's forced edge-to-edge the bar sat beneath the
          status bar's clock. Adding it twice would push the bar a status bar's
          height down the screen instead. */}
        <div className="relative z-[1000] mx-4 mt-3">
          <label
            className="flex items-center gap-2.5 rounded-full px-4 py-3 backdrop-blur-md"
            style={{ background: 'rgba(31,41,55,.94)', border: '1px solid rgba(243,244,246,.1)' }}
          >
            <Search size={17} style={{ color: '#9ca3af' }} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('mobile.map.searchPlaceholder')}
              aria-label={t('mobile.map.searchPlaceholder')}
              className="w-full flex-1 select-text bg-transparent text-[13.5px] outline-none"
              style={{ color: '#f3f4f6' }}
            />
          </label>
          {results.length > 0 && (
            <ul
              className="absolute mt-1.5 max-h-64 w-full overflow-auto rounded-2xl backdrop-blur-md"
              style={{ background: 'rgba(31,41,55,.96)', border: '1px solid rgba(243,244,246,.1)' }}
            >
              {results.map((m, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => selectResult(m)}
                    className="w-full px-4 py-2.5 text-left text-[13.5px]"
                    style={{ color: '#f3f4f6' }}
                  >
                    {resultLabel(m)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <MapSheet />
      </div>
    </div>
  );
}
