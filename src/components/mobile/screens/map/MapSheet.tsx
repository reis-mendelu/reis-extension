import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react';
import { useMapSheetDrag } from './useMapSheetDrag';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { MapPanelBody } from './MapPanelBody';

/** The collapsed height, in px — kept in sync with the `h-[166px]` class below. */
const PEEK_PX = 166;

/** The expanded height as a fraction of the viewport, matching `h-[70vh]`. */
const EXPANDED_VH = 0.7;

/**
 * The map screen's bottom sheet: a drag handle that's always visible, then
 * either a one-line peek summary or the Akce/Knihovna/Budova tabs, driven by
 * `mapSheetState` (Task 3's mobile UI slice — no local state here).
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
  const selection = useAppStore((s) => s.mapSelection);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const { t } = useTranslation();
  const selectedEvent = selection?.kind === 'event' ? selection.event : null;

  // `peek` is the only stop that hides the list. Both taller stops show it —
  // the middle one is the whole point of the third detent: the campus events
  // used to be readable only by dragging the sheet up over the map, and its
  // peek band was blank under its own title.
  const expanded = sheetState !== 'peek';
  const fullyExpanded = sheetState === 'expanded';
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
    if (selectedEvent) setSheetState('half');
  }, [selectedEvent, setSheetState]);

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
  const hugContent = !!selectedEvent;

  return (
    <div
      ref={panelRef}
      data-testid="map-sheet"
      {...handlers}
      // The height transition is dropped mid-drag: it animates the same height
      // the finger is setting, and leaving both on makes the sheet lag behind.
      // The height transition is dropped mid-drag: it animates the same height
      // the finger is setting, and leaving both on makes the sheet lag behind.
      className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-[20px] bg-base-100 shadow-drawer ${
        dragHeight === null ? 'transition-[height] duration-300 ease-out' : ''
      } ${
        hugContent
          ? 'h-auto max-h-[70vh]'
          : fullyExpanded
            ? 'h-[70vh]'
            : sheetState === 'half'
              ? 'h-[45vh]'
              : 'h-[166px]'
      }`}
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
              // md:pt-5 — on a phone the drag handle above supplies the top
              // padding; the rail hides that handle, and without this the title
              // sat hard against the panel's rounded top edge.
              className="flex flex-shrink-0 touch-none items-center gap-1.5 px-5 pb-2 text-left"
            >
              <ChevronLeft size={18} className="flex-shrink-0 text-base-content/40" />
              <span className="font-display text-lg font-bold tracking-tight text-base-content">
                {t('mobile.map.tabEvents')}
              </span>
            </button>
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
          {/* pb-24 clears the floating BottomNav, which is positioned against
              the SCREEN and draws over the sheet. */}
          <div className="flex-1 overflow-y-auto pb-24 pt-2">
            <MapPanelBody selectedEvent={selectedEvent} />
          </div>
        </>
      )}
    </div>
  );
}
