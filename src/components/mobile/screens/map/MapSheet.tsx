import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react';
import { snapDetent, dragOwnsGesture, consumesTravel } from '../../primitives/sheetDrag';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MapSheetTab } from '../../../../store/types';
import buildingsJson from '../../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../../types/campusMap';
import { MapEventsSection } from '../../../CampusMap/MapEventsSection';
import { EventDetailCard } from '../../../CampusMap/EventDetailCard';
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
  const selection = useAppStore((s) => s.mapSelection);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const { t } = useTranslation();
  const selectedEvent = selection?.kind === 'event' ? selection.event : null;

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
    // Cleared before the ownership check, not after: a new gesture always starts
    // undragged. Leaving it to the owned path means a flag set by a previous
    // drag can survive into a gesture the sheet does not own, and
    // swallowClickAfterDrag then eats that tap.
    dragged.current = false;
    // Only a gesture the content does not want: while the expanded Akce list is
    // scrolled down, a downward swipe belongs to the list, not the sheet.
    if (!dragOwnsGesture(e.target as Element, panelRef.current)) return;
    const height = panelRef.current?.getBoundingClientRect().height ?? PEEK_PX;
    start.current = { y: e.clientY, t: e.timeStamp, height };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (!from) return;
    const dy = e.clientY - from.y;
    // Travel the sheet cannot absorb belongs to the content: at peek a downward
    // drag has nowhere to go, and while expanded an upward one scrolls the list.
    if (!consumesTravel(sheetState, dy)) return;
    dragged.current = true;
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

  /**
   * The whole sheet is a drag surface, not just the handle — dragging a sheet
   * down anywhere on it is what every native sheet does.
   *
   * This needs a NON-PASSIVE touchmove: React attaches touch listeners
   * passively, so `preventDefault` from onPointerMove is a no-op and the
   * browser takes the gesture as a pan and fires pointercancel mid-drag. Only
   * while the sheet is actually absorbing the travel — otherwise this would
   * block the Akce list from ever scrolling.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onTouchMove = (e: TouchEvent) => {
      const from = start.current;
      const touch = e.touches[0];
      if (!from || !touch) return;
      if (consumesTravel(sheetState, touch.clientY - from.y)) e.preventDefault();
    };
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => panel.removeEventListener('touchmove', onTouchMove);
  }, [sheetState]);

  /**
   * Tapping an event pin selects it, and on a phone this sheet is the only
   * surface that can show it — desktop has DetailPanel floating over the map,
   * which there is no room for here. A selection made at peek height would
   * otherwise be invisible: the pin would highlight and nothing else would
   * happen.
   */
  useEffect(() => {
    if (selectedEvent) setSheetState('expanded');
  }, [selectedEvent, setSheetState]);

  /**
   * A drag ends in a click on whatever was under the finger. The handle and the
   * tabs guard against that individually, but the sheet's CONTENT never did —
   * and now that content includes an event card, so collapsing the sheet with a
   * downward drag that starts on it could cast an RSVP, clear the selected
   * event, or jump to a room as a side effect.
   *
   * Handled once here in the capture phase instead of per control: the click is
   * swallowed before it reaches any target, so nothing inside needs to know
   * about dragging.
   */
  const swallowClickAfterDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // A cancel is the BROWSER taking the gesture over, not the student letting
  // go — the only outcome is "put it back". Mirrors Sheet's handling.
  const onPointerCancel = () => {
    start.current = null;
    setDragHeight(null);
    // A cancelled drag produces no click, so the suppression flag has nothing
    // to suppress — left set, it would eat the student's NEXT real tap instead.
    dragged.current = false;
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
      // Same suppression as the handle: a drag that starts on a tab ends in a
      // click on it, which would switch tab as a side effect of collapsing.
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        setTab(key);
      }}
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
      onClickCapture={swallowClickAfterDrag}
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
          {/* touch-none here too, not just on the handle: the handle is a 4px
              pill at the top of a 70vh sheet, so collapsing meant reaching to
              the top of the screen. The tab row is the nearest grab surface to
              the content the student is actually looking at. */}
          {/* Library study-room reservation is hidden on mobile, so unless a
              building is selected there is exactly ONE tab — and a segmented
              control around a single choice is all chrome: a track, and a
              white selected pill framing the only thing you could pick. The
              row still has to exist (it is the nearest grab surface for
              collapsing a 70vh sheet — see the touch-none note above), so it
              becomes a plain heading whose tap collapses instead. */}
          {selectedEvent ? (
            // A tapped pin replaces the tabs outright: the card IS the answer to
            // the tap, and leaving a tab row above it invites switching away
            // from the thing just asked for. Back returns to the list.
            <button
              type="button"
              onClick={clearMapSelection}
              className="flex flex-shrink-0 touch-none items-center gap-1.5 px-5 pb-2 text-left"
            >
              <ChevronLeft size={18} className="flex-shrink-0 text-base-content/40" />
              <span className="font-display text-lg font-bold tracking-tight text-base-content">
                {t('mobile.map.tabEvents')}
              </span>
            </button>
          ) : showBudova ? (
            <div
              role="tablist"
              className="mx-4 flex flex-shrink-0 touch-none gap-1 rounded-lg bg-base-content/5 p-1"
            >
              {tabBtn('akce', t('mobile.map.tabEvents'))}
              {tabBtn('budova', t('mobile.map.tabBuilding', { name: buildingName }))}
            </div>
          ) : (
            <button
              type="button"
              onClick={toggle}
              className="flex flex-shrink-0 touch-none items-center justify-between px-5 pb-2 text-left"
            >
              {/* Sized as the sheet's title, not as the tab it replaced: at
                  13.5px it read as a label floating above the filter chips
                  rather than as the heading for everything below it. Matches
                  the other full sheets' headers. */}
              <span className="font-display text-lg font-bold tracking-tight text-base-content">
                {t('mobile.map.tabEvents')}
              </span>
              <ChevronDown
                size={20}
                className="flex-shrink-0 text-base-content/40"
                aria-hidden="true"
              />
            </button>
          )}
          <div className="flex-1 overflow-y-auto pb-24 pt-2">
            {selectedEvent ? (
              <div className="px-4">
                <EventDetailCard event={selectedEvent} />
              </div>
            ) : (
              <>
                {activeTab === 'akce' && <MapEventsSection />}
                {activeTab === 'budova' && activeBuildingId !== null && (
                  <BuildingRoomList buildingId={activeBuildingId} />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
