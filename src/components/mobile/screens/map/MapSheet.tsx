import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react';
import { useMapSheetDrag } from './useMapSheetDrag';
import { useWideViewport } from '../../../../hooks/ui/useWideViewport';
import { useRailResize } from './useRailResize';
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
  /**
   * On a tablet this stops being a sheet and becomes a rail down the right.
   *
   * The detents are a phone answer to a phone problem — a card competing with
   * the map for the SAME axis. An iPad has width going spare and no height to
   * waste, so the card takes a column and the map keeps its whole height. It
   * also retires the drag: a full-height rail has one state, so there is
   * nothing to drag it to.
   */
  const isRail = useWideViewport();
  const railWidth = useAppStore((s) => s.mapRailWidth);
  const { resizing, railHandlers } = useRailResize();
  const sheetState = useAppStore((s) => s.mapSheetState);
  const setSheetState = useAppStore((s) => s.setMapSheetState);
  const tab = useAppStore((s) => s.mapTab);
  const setTab = useAppStore((s) => s.setMapTab);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const { t } = useTranslation();
  const selectedEvent = selection?.kind === 'event' ? selection.event : null;

  // `peek` is the only stop that hides the list. Both taller stops show it —
  // the middle one is the whole point of the third detent: the campus events
  // used to be readable only by dragging the sheet up over the map, and its
  // peek band was blank under its own title.
  // A rail is always open: there is no peek state to be in when the card is
  // not covering anything.
  const expanded = isRail || sheetState !== 'peek';
  const fullyExpanded = sheetState === 'expanded';
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
  const { dragHeight, consumeDragClick, handlers } = useMapSheetDrag(
    sheetState,
    setSheetState,
    panelRef,
    PEEK_PX,
    EXPANDED_VH
  );

  // A drag ends in a click too, and letting that click through would toggle the
  // sheet straight back out of the detent the drag just chose.
  // Walks the ladder rather than flipping: tapping up from peek lands on the
  // middle stop, the same place a drag would, so tap and drag agree. From the
  // top it returns all the way down, which is what a collapse chevron means.
  const toggle = () => {
    if (consumeDragClick()) return;
    setSheetState(sheetState === 'peek' ? 'half' : sheetState === 'half' ? 'expanded' : 'peek');
  };

  /**
   * Tapping an event pin selects it, and on a phone this sheet is the only
   * surface that can show it — desktop has DetailPanel floating over the map,
   * which there is no room for here. A selection made at peek height would
   * otherwise be invisible: the pin would highlight and nothing else would
   * happen.
   */
  useEffect(() => {
    // 'half', not 'expanded' — and the height below hugs the card anyway. Any
    // state out of 'peek' will do; what this call is really for is getting the
    // peek row out of the way so the card can render at all.
    //
    // Pointless in the rail, and harmful there: it would leave the sheet stuck
    // at 70vh for anyone who resized an iPad window back to phone width.
    if (selectedEvent && !isRail) setSheetState('half');
  }, [selectedEvent, setSheetState, isRail]);

  /**
   * A single event card is ~300px of content. Pinning the sheet to a detent
   * for it meant 70vh of sheet holding 300px of card — on an 812px phone that
   * is 260px of blank white between the buttons and the bottom, and the map it
   * was describing was behind it.
   *
   * So while one event is showing, the sheet is sized by its content instead of
   * by a detent, capped so a long description still cannot swallow the map. The
   * tabbed list keeps the detents: that content is a scrollable list with no
   * natural height, which is what detents are for.
   */
  const hugContent = !!selectedEvent && !isRail;

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
        if (consumeDragClick()) return;
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
      {...handlers}
      // The height transition is dropped mid-drag: it animates the same height
      // the finger is setting, and leaving both on makes the sheet lag behind.
      // md: the sheet becomes a rail that FLOATS over the map — inset on three
      // sides, rounded all round, hairline bordered.
      //
      // Floating rather than docking is this screen's own idiom, not a taste
      // call: the search bar above is already a rounded pill sitting over the
      // canvas with a margin, and a panel welded to the screen edge beside it
      // reads as furniture from a different app. The inset is also what keeps
      // the map continuous behind the rail, which is the entire reason the
      // rail exists instead of a sheet.
      //
      // The border is not trim: `base-100` on `base-200` is 1.03:1 in the light
      // theme, so a floating panel with no hairline has no edge there at all.
      //
      // It starts BELOW the search bar. 5rem is that bar's 1rem margin plus its
      // ~3rem height plus a 1rem gap, and it carries --safe-top for the same
      // reason the bar does: on device the status bar is above both.
      className={`absolute z-[1000] flex flex-col overflow-hidden bg-base-100 shadow-drawer inset-x-0 bottom-0 rounded-t-[20px] md:inset-x-auto md:bottom-4 md:right-4 md:top-[calc(5rem_+_var(--safe-top,0px))] md:rounded-2xl md:border md:border-base-content/10 ${
        dragHeight === null || isRail ? 'transition-[height] duration-300 ease-out' : ''
      } ${
        hugContent
          ? 'h-auto max-h-[70vh]'
          : fullyExpanded
            ? 'h-[70vh]'
            : sheetState === 'half'
              ? 'h-[45vh]'
              : 'h-[166px]'
      } md:h-auto`}
      // Width is inline because the student sets it; height is inline only
      // mid-drag on a phone. They are mutually exclusive: an inline HEIGHT
      // would beat `md:h-auto` and leave the rail 166px tall in the corner,
      // and an inline WIDTH on a phone would shrink the full-width sheet.
      style={
        isRail
          ? { width: railWidth }
          : dragHeight === null
            ? undefined
            : { height: `${dragHeight}px` }
      }
    >
      {/* The rail's left edge is its handle — the same gesture the phone uses
          on the top edge, rotated onto the axis that is scarce here. A tablet
          has width to trade and no height to spare; a phone the reverse. Wide
          enough to hit (12px) with a 3px pill for the eye, exactly like the
          phone's grab pill. */}
      {isRail && (
        <div
          {...railHandlers}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('mobile.map.railResize')}
          className={`group absolute inset-y-0 left-0 z-10 hidden w-3 cursor-col-resize touch-none items-center justify-center md:flex ${
            resizing ? 'opacity-100' : 'opacity-60'
          }`}
        >
          <span
            className={`block h-10 w-[3px] rounded-full transition-colors ${
              resizing ? 'bg-primary' : 'bg-base-300 group-hover:bg-base-content/30'
            }`}
          />
        </div>
      )}

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
        className="flex-shrink-0 touch-none pb-1 pt-2 md:hidden"
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
              // md:pt-5 — on a phone the drag handle above supplies the top
              // padding; the rail hides that handle, and without this the title
              // sat hard against the panel's rounded top edge.
              className="flex flex-shrink-0 touch-none items-center gap-1.5 px-5 pb-2 text-left md:pl-6 md:pt-5"
            >
              <ChevronLeft size={18} className="flex-shrink-0 text-base-content/40" />
              <span className="font-display text-lg font-bold tracking-tight text-base-content">
                {t('mobile.map.tabEvents')}
              </span>
            </button>
          ) : showBudova ? (
            <div
              role="tablist"
              className="mx-4 flex flex-shrink-0 touch-none gap-1 rounded-lg bg-base-content/5 p-1 md:mt-5"
            >
              {tabBtn('akce', t('mobile.map.tabEvents'))}
              {tabBtn('budova', t('mobile.map.tabBuilding', { name: buildingName }))}
            </div>
          ) : (
            <button
              type="button"
              onClick={toggle}
              className="flex flex-shrink-0 touch-none items-center justify-between px-5 pb-2 text-left md:pl-6 md:pt-5"
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
          {/* pb-24 clears the floating BottomNav, which is positioned against
              the SCREEN and draws over the sheet. The rail sits to the right of
              that nav and is never under it, so on a tablet the same padding is
              just 96px of dead white at the bottom of the panel. */}
          <div className="flex-1 overflow-y-auto pb-24 pt-2 md:pb-4 md:pl-1">
            {selectedEvent ? (
              // Framed on a phone, where the card is the surface; flush in the
              // rail, which is already the frame.
              <div className="px-4 md:px-5">
                <EventDetailCard event={selectedEvent} flush={isRail} />
              </div>
            ) : (
              <>
                {activeTab === 'akce' && <MapEventsSection showFilter={false} />}
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
