import { useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';
import { useMapSheetDrag } from './useMapSheetDrag';
import { useAppStore } from '../../../../store/useAppStore';
import { RouteButton } from '../../../CampusMap/RouteButton';
import { RouteCard } from '../../../CampusMap/RouteCard';
import { RoutePicker } from '../../../CampusMap/RoutePicker';
import { CAMPUS_NAVIGATION_ENABLED } from '../../../../utils/routing/navigationEnabled';
import { useTranslation } from '../../../../hooks/useTranslation';
import { MapPanelBody } from './MapPanelBody';
import { MapSheetPeek } from './MapSheetPeek';
import { MapSheetHeader } from './MapSheetHeader';
import { useSafeBottom } from '../../../../hooks/ui/useSafeBottom';
import { peekHeightPx } from '../../../../utils/mobile/safeArea';
import type { Detent } from '../../primitives/sheetDrag';

/** The expanded height as a fraction of the viewport, matching `h-[70vh]`. */
const EXPANDED_VH = 0.7;

/**
 * The map screen's bottom sheet: a drag handle that's always visible, then
 * either the closed band (`MapSheetPeek` — the next event) or the open panel
 * (`MapSheetHeader` + the list), driven by `mapSheetState` (the mobile UI
 * slice — no local state here).
 *
 * The collapsed height reserves the bottom ~96px for the floating `BottomNav`,
 * which is positioned against the SCREEN, not this sheet, and so draws
 * straight over it. Sizing the collapsed sheet to its content instead puts the
 * peek row underneath the nav pill; the prototype reserves the same band. The
 * band grows by `--safe-bottom`, because the nav it is reserving for does too
 * — see `utils/mobile/safeArea.ts`.
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
  const routeStatus = useAppStore((s) => s.routeStatus);
  const setSheetState = useAppStore((s) => s.setMapSheetState);
  const selection = useAppStore((s) => s.mapSelection);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const { t } = useTranslation();
  const selectedEvent = selection?.kind === 'event' ? selection.event : null;
  // A bubble in the botanical garden, tapped. Treated exactly as a tapped event
  // pin is: the card IS the answer to the tap, so it replaces the list and the
  // sheet hugs it rather than sitting at a detent.
  const selectedGardenPlace = selection?.kind === 'gardenPlace' ? selection.place : null;
  const selectedCard = selectedEvent || selectedGardenPlace;

  // `peek` is the only stop that hides the LIST. It is no longer blank — it
  // shows the next event (`MapSheetPeek`) — but one row is not the week, which
  // is what the middle stop is for: the campus events used to be readable only
  // by dragging the sheet up over the map.
  const expanded = sheetState !== 'peek';
  const fullyExpanded = sheetState === 'expanded';
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Every route to a stop — tap and drag alike — so that collapsing always
   * drops a pin's card with it.
   *
   * Leaving the selection behind at peek stranded the pin: the effect below
   * opens the sheet for a selection and keys on the selected place/event
   * REFERENCE, which is the same object each time that bubble is tapped, so a
   * second tap changed no dep, ran no effect and did nothing at all. It also
   * made the peek row lie — it says "Akce na kampusu" and would have reopened
   * onto a photograph of a pond.
   */
  const goToDetent = (next: Detent) => {
    if (next === 'peek' && selectedCard) clearMapSelection();
    setSheetState(next);
  };

  // The drag's floor and the resting height below are ONE number, derived
  // from the same inset. They used to be a `166` constant and an `h-[166px]`
  // class kept in step by a comment; once the class grew by --safe-bottom, a
  // constant left behind would let a drag undershoot the resting height by
  // the whole system bar and snap back.
  const peekPx = peekHeightPx(useSafeBottom());
  const { dragHeight, consumeDragClick, handlers } = useMapSheetDrag(
    sheetState,
    goToDetent,
    panelRef,
    peekPx,
    EXPANDED_VH
  );

  // A drag ends in a click too, and letting that click through would toggle the
  // sheet straight back out of the detent the drag just chose.
  //
  // Binary, not a rung of the ladder: every surface that calls this shows ONE
  // chevron, and at any stop above peek that chevron points DOWN and is
  // labelled "Sbalit panel mapy". Walking up a rung from `half` — which is
  // where the sheet opens — meant the collapse affordance made the sheet
  // taller, 365px to 568px, reported as "clicking on the expanded drawer just
  // expands it even more". The ladder belongs to the DRAG, which is directional
  // and can stop at `expanded`; a tap can only mean the direction it is drawn
  // as.
  const toggle = () => {
    if (consumeDragClick()) return;
    goToDetent(expanded ? 'peek' : 'half');
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
    if (selectedEvent || selectedGardenPlace) setSheetState('half');
  }, [selectedEvent, selectedGardenPlace, setSheetState]);

  // A drawn route is an answer, and the sheet is 45% of the screen in front of
  // it. Whatever the student had open, the map wins the moment directions
  // exist — the same reflex as the force-expand above, pointing the other way.
  useEffect(() => {
    if (routeStatus === 'ready') setSheetState('peek');
  }, [routeStatus, setSheetState]);

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
  // The picker is sheet CONTENT, not a popover: this root is overflow-hidden,
  // so anything opening upward out of it is clipped. Hugging lets the sheet
  // grow to fit it and shrink back.
  const routePickerOpen = useAppStore((s) => s.routePickerOpen);
  // Three reasons to hug, and only the card's is gated on being open. The card
  // renders above peek ONLY, so hugging it at peek sized the sheet to
  // something it was not showing — the peek row alone is ~52px, under the
  // 166px band the floating BottomNav is drawn over, which left the hint row
  // half-buried behind the nav pill. A route status is the opposite: it shows
  // AT peek, above the row, and the fixed band has no room for both.
  const hugContent = (!!selectedCard && expanded) || routePickerOpen || routeStatus !== 'idle';

  return (
    <div
      ref={panelRef}
      data-testid="map-sheet"
      {...handlers}
      // The height transition is dropped mid-drag: it animates the same height
      // the finger is setting, and leaving both on makes the sheet lag behind.
      // `pb-[72px]` while hugging: the BottomNav FLOATS over this sheet rather
      // than sitting under it, so a sheet sized to its own content puts its
      // last row behind the nav. At the fixed detents the content is short
      // enough that this never showed.
      //
      // bg-base-200, the PAGE tone, not the card tone. The floating BottomNav
      // is `bg-base-100` and is drawn against the screen, so on a base-100
      // sheet it was the same colour as the surface it floats over — 1.00:1,
      // separated only by its hairline — and the pill read as welded into the
      // sheet instead of hovering above it. Every other screen gives it a
      // base-200 page to float over; this one now does too. The children were
      // already written for a page: EventDetailCard wraps itself in a
      // `bg-base-100` card that was invisible here for the same reason.
      className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-[20px] bg-base-200 shadow-drawer ${
        dragHeight === null ? 'transition-[height] duration-300 ease-out' : ''
      } ${
        hugContent
          ? 'h-auto max-h-[70vh] pb-[72px]'
          : fullyExpanded
            ? 'h-[70vh]'
            : sheetState === 'half'
              ? 'h-[45vh]'
              : 'h-[calc(166px_+_var(--safe-bottom,0px))]'
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

      {/* The answer, when there is one. Above the peek row so the row below
          still says what is underneath the sheet and still expands it. */}
      {!expanded && CAMPUS_NAVIGATION_ENABLED && <RouteCard />}

      {/* ABOVE the button that opens it, not below. Below, the picker grew the
          sheet downward into the floating BottomNav, which covered the letters
          — and a menu that opens away from its own control reads as unrelated
          to it. */}
      {!expanded && CAMPUS_NAVIGATION_ENABLED && <RoutePicker />}

      {!expanded && (
        // A ROW of two controls, not one button: the left half expands the
        // sheet, the right half asks for a route. Siblings rather than nested,
        // because a button inside a button swallows its own click.
        //
        // This is where the route control lives, and the reason is contrast,
        // not tidiness. Floating over the map it was `btn btn-primary` — a pale
        // green pill on a basemap that is always light, whatever the app theme
        // — and it read as a ghost. Everything that floats over this map either
        // carries its own dark surface (as the search bar does, with a
        // hardcoded rgba) or disappears. On the sheet it simply works, in both
        // themes.
        <div className="flex flex-shrink-0 touch-none items-center gap-2 px-4 pb-3.5 pt-0.5">
          <button
            type="button"
            data-testid="map-sheet-peek"
            onClick={toggle}
            // No aria-label: the band's whole point is that it now SAYS what is
            // on, and a label would replace that with the word "expand".
            aria-expanded={false}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
          >
            <MapSheetPeek />
            <ChevronUp
              size={18}
              className="flex-shrink-0 text-base-content/40"
              aria-hidden="true"
            />
          </button>
          {CAMPUS_NAVIGATION_ENABLED && <RouteButton />}
        </div>
      )}

      {expanded && (
        <>
          <MapSheetHeader
            showingCard={!!selectedCard}
            onCollapse={toggle}
            onBack={clearMapSelection}
          />
          {/* pb-24 clears the floating BottomNav, which is positioned against
              the SCREEN and draws over the sheet. */}
          <div className="flex-1 overflow-y-auto pb-[calc(6rem_+_var(--safe-bottom,0px))] pt-2">
            <MapPanelBody selectedEvent={selectedEvent} selectedGardenPlace={selectedGardenPlace} />
          </div>
        </>
      )}
    </div>
  );
}
