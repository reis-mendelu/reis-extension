import { Search } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { MapCanvas } from '../../CampusMap/MapCanvas';
import { FloorSwitcher } from './map/FloorSwitcher';
import { MapSheet } from './map/MapSheet';

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

    return (
        <div data-testid="map-screen" className="relative isolate flex flex-1 flex-col overflow-hidden">
            <MapCanvas />
            <FloorSwitcher />
            <div
                className="relative z-[1000] mx-4 mt-4 flex items-center gap-2.5 rounded-full px-4 py-3 backdrop-blur-md"
                style={{ background: 'rgba(31,41,55,.94)', border: '1px solid rgba(243,244,246,.1)' }}
            >
                <Search size={17} style={{ color: '#9ca3af' }} aria-hidden="true" />
                <span className="text-[13.5px]" style={{ color: '#9ca3af' }}>
                    {t('mobile.map.searchPlaceholder')}
                </span>
            </div>
            <MapSheet />
        </div>
    );
}
