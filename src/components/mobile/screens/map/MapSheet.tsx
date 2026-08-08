import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronUp } from 'lucide-react';
import { snapDetent, dragOwnsGesture } from '../../primitives/sheetDrag';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MapSheetTab } from '../../../../store/types';
import buildingsJson from '../../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../../types/campusMap';
import { MapEventsSection } from '../../../CampusMap/MapEventsSection';
import { BuildingRoomList } from './BuildingRoomList';

const META = buildingsJson as BuildingsMeta;

/** The collapsed height, in px — kept in sync with the `h-[166px]` class below. */
const PEEK_PX = 166;

/** The expanded height as a fraction of the viewport, matching `h-[70vh]`. */
const EXPANDED_VH = 0.7;

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
  // 'knihovna' joins that fallback: the library study-room tab is hidden on
  // mobile, and a persisted selection of it would otherwise leave the sheet
  // rendering nothing with no tab to click back to.
  const activeTab: MapSheetTab =
    (tab === 'budova' && !showBudova) || tab === 'knihovna' ? 'akce' : tab;
  const panelRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number; height: number } | null>(null);
  const dragged = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // A drag ends in a click too, and letting that click through would toggle the
  // sheet straight back out of the detent the drag just chose.
  const toggle = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setSheetState(expanded ? 'peek' : 'expanded');
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only a gesture the content does not want: while the expanded Akce list is
    // scrolled down, a downward swipe belongs to the list, not the sheet.
    if (!dragOwnsGesture(e.target as Element, panelRef.current)) return;
    const height = panelRef.current?.getBoundingClientRect().height ?? PEEK_PX;
    start.current = { y: e.clientY, t: e.timeStamp, height };
    dragged.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (!from) return;
    const dy = e.clientY - from.y;
    if (dy !== 0) dragged.current = true;
    // Clamped to the two detents: peek is the floor because this sheet is the
    // only way to reach Akce, and 70vh is the ceiling it snaps to.
    const max = window.innerHeight * EXPANDED_VH;
    const next = from.height - dy;
    setDragHeight(Math.min(Math.max(next, PEEK_PX), max));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    setDragHeight(null);
    if (!from) return;
    setSheetState(snapDetent(sheetState, e.clientY - from.y, e.timeStamp - from.t));
  };

  // A cancel is the BROWSER taking the gesture over, not the student letting
  // go — the only outcome is "put it back". Mirrors Sheet's handling.
  const onPointerCancel = () => {
    start.current = null;
    setDragHeight(null);
  };

  const buildingName =
    activeBuildingId !== null
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
        activeTab === key ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={panelRef}
      data-testid="map-sheet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // The height transition is dropped mid-drag: it animates the same height
      // the finger is setting, and leaving both on makes the sheet lag behind.
      className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-[20px] bg-base-100 shadow-drawer ${
        dragHeight === null ? 'transition-[height] duration-300 ease-out' : ''
      } ${expanded ? 'h-[70vh]' : 'h-[166px]'}`}
      style={dragHeight === null ? undefined : { height: `${dragHeight}px` }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={t(expanded ? 'mobile.map.sheetCollapse' : 'mobile.map.sheetExpand')}
        // touch-none is what makes the pill below more than decoration. This
        // div owns the pointer handlers and these events bubble up to it, but
        // with the default touch-action the browser claims the gesture as a pan
        // partway through and fires pointercancel — measured on device for the
        // other sheets, where a 350px swipe was cut off after ~20px. Scoped to
        // the handle and peek row so the expanded list keeps scrolling.
        className="flex-shrink-0 touch-none pb-1 pt-2"
      >
        <span className="mx-auto block h-1 w-9 rounded-full bg-base-300" />
      </button>

      {!expanded && (
        <button
          type="button"
          onClick={toggle}
          className="flex flex-shrink-0 touch-none items-center justify-between px-5 pb-3.5 pt-0.5 text-left"
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
            {/* Library study-room reservation is hidden on mobile. */}
            {showBudova && tabBtn('budova', t('mobile.map.tabBuilding', { name: buildingName }))}
          </div>
          <div className="flex-1 overflow-y-auto pb-24 pt-2">
            {activeTab === 'akce' && <MapEventsSection />}
            {activeTab === 'budova' && activeBuildingId !== null && (
              <BuildingRoomList buildingId={activeBuildingId} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
