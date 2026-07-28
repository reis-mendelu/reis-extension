import { ChevronUp } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MapSheetTab } from '../../../../store/types';
import buildingsJson from '../../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../../types/campusMap';
import { MapEventsSection } from '../../../CampusMap/MapEventsSection';
import { MapLibrarySection } from '../../../CampusMap/MapLibrarySection';
import { BuildingRoomList } from './BuildingRoomList';

const META = buildingsJson as BuildingsMeta;

/**
 * The map screen's bottom sheet: a drag handle that's always visible, then
 * either a one-line peek summary or the Akce/Knihovna/Budova tabs, driven by
 * `mapSheetState` / `mapTab` (Task 3's mobile UI slice — no local state here).
 *
 * The collapsed height reserves the bottom ~96px for the floating `BottomNav`,
 * which is positioned against the SCREEN (bottom-[18px]), not this sheet, and
 * so draws straight over it. Sizing the collapsed sheet to its content instead
 * puts the peek row underneath the nav pill; the prototype reserves the same
 * band.
 *
 * This is rendered as a sibling of `MapCanvas` in `MapScreen`, never a
 * wrapper around it: expanding/collapsing only changes THIS component's own
 * height. MapCanvas's own container is `absolute inset-0` against MapScreen,
 * not against this sheet, so its box never resizes when the sheet does —
 * Leaflet's tiles are unaffected and `invalidateSize()` isn't needed for this
 * transition (see MapScreen.tsx for the fuller note).
 */
export function MapSheet() {
    const sheetState = useAppStore((s) => s.mapSheetState);
    const setSheetState = useAppStore((s) => s.setMapSheetState);
    const tab = useAppStore((s) => s.mapTab);
    const setTab = useAppStore((s) => s.setMapTab);
    const activeBuildingId = useAppStore((s) => s.activeBuildingId);
    const { t } = useTranslation();

    const expanded = sheetState === 'expanded';
    const showBudova = activeBuildingId !== null;
    // A previously-picked Budova tab goes stale the moment the building is
    // deselected (exitToCampus) — fall back to Akce instead of rendering
    // nothing, mirroring how MapSidePanel's `active` override handles its own
    // mode/tab mismatch.
    const activeTab: MapSheetTab = tab === 'budova' && !showBudova ? 'akce' : tab;
    const toggle = () => setSheetState(expanded ? 'peek' : 'expanded');

    const buildingName = activeBuildingId !== null
        ? (META.buildings.find((b) => b.id === activeBuildingId)?.name ?? '')
        : '';

    const tabBtn = (key: MapSheetTab, label: string) => (
        <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold ${
                activeTab === key
                    ? 'bg-base-100 text-base-content shadow-sm'
                    : 'text-base-content/60'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div
            data-testid="map-sheet"
            className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-[20px] bg-base-100 shadow-drawer transition-[height] duration-300 ease-out ${
                expanded ? 'h-[70vh]' : 'h-[166px]'
            }`}
        >
            <button
                type="button"
                onClick={toggle}
                aria-label={t(expanded ? 'mobile.map.sheetCollapse' : 'mobile.map.sheetExpand')}
                className="flex-shrink-0 pb-1 pt-2"
            >
                <span className="mx-auto block h-1 w-9 rounded-full bg-base-300" />
            </button>

            {!expanded && (
                <button
                    type="button"
                    onClick={toggle}
                    className="flex flex-shrink-0 items-center justify-between px-5 pb-3.5 pt-0.5 text-left"
                >
                    <span className="text-[13.5px] font-semibold text-base-content">
                        {t('mobile.map.peekHint')}
                    </span>
                    <ChevronUp size={18} className="flex-shrink-0 text-base-content/40" aria-hidden="true" />
                </button>
            )}

            {expanded && (
                <>
                    <div role="tablist" className="mx-4 flex flex-shrink-0 gap-1 rounded-lg bg-base-200 p-1">
                        {tabBtn('akce', t('mobile.map.tabEvents'))}
                        {tabBtn('knihovna', t('mobile.map.tabLibrary'))}
                        {showBudova && tabBtn('budova', t('mobile.map.tabBuilding', { name: buildingName }))}
                    </div>
                    <div className="flex-1 overflow-y-auto pb-24 pt-2">
                        {activeTab === 'akce' && <MapEventsSection />}
                        {activeTab === 'knihovna' && <MapLibrarySection />}
                        {activeTab === 'budova' && activeBuildingId !== null && (
                            <BuildingRoomList buildingId={activeBuildingId} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
