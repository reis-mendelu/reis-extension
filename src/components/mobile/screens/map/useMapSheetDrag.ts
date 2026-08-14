import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  snapDetent,
  dragOwnsGesture,
  consumesTravel,
  DRAG_SLOP_PX,
  type Detent,
} from '../../primitives/sheetDrag';

/**
 * The map sheet's drag behaviour: pointer handling, the live height while a
 * finger is down, and the suppression of the click a drag ends in.
 *
 * Extracted from MapSheet so the view is a view. These rules took four rounds of
 * review to settle and are subtle enough to be worth reading on their own — the
 * pure decisions they lean on (`snapDetent`, `consumesTravel`, `DRAG_SLOP_PX`)
 * live in primitives/sheetDrag.ts.
 */
export function useMapSheetDrag(
  sheetState: Detent,
  setSheetState: (d: Detent) => void,
  panelRef: RefObject<HTMLDivElement | null>,
  peekPx: number,
  expandedVh: number
) {
  const start = useRef<{ y: number; t: number; height: number } | null>(null);
  /** Whether the current gesture moved the sheet, so its click must be eaten. */
  const dragged = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Cleared before the ownership check, not after: a new gesture always starts
    // undragged. Leaving it to the owned path lets a flag set by a previous drag
    // survive into a gesture the sheet does not own, and the click swallow below
    // then eats that tap.
    dragged.current = false;
    // Only a gesture the content does not want: while the expanded Akce list is
    // scrolled down, a downward swipe belongs to the list, not the sheet.
    if (!dragOwnsGesture(e.target as Element, panelRef.current)) return;
    const height = panelRef.current?.getBoundingClientRect().height ?? peekPx;
    start.current = { y: e.clientY, t: e.timeStamp, height };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (!from) return;
    const dy = e.clientY - from.y;
    // Travel the sheet cannot absorb belongs to the content: at peek a downward
    // drag has nowhere to go, and while expanded an upward one scrolls the list.
    if (!consumesTravel(sheetState, dy)) return;
    // The sheet follows the finger from the first pixel, but only past the slop
    // does the gesture count as a drag for click-suppression — otherwise the
    // jitter in an ordinary tap swallows it.
    if (Math.abs(dy) >= DRAG_SLOP_PX) dragged.current = true;
    // Clamped to the two detents: peek is the floor because this sheet is the
    // only way to reach Akce, and 70vh is the ceiling it snaps to.
    const max = window.innerHeight * expandedVh;
    setDragHeight(Math.min(Math.max(from.height - dy, peekPx), max));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    setDragHeight(null);
    if (!from) return;
    const next = snapDetent(sheetState, e.clientY - from.y, e.timeStamp - from.t);
    // The slop and snapDetent measure different things, and disagree on a fast
    // flick shorter than the slop: too small to count as a drag, fast enough to
    // change detent. The sheet would move AND the trailing click would land on
    // whatever was under the finger. Whether the gesture MOVED THE SHEET is the
    // question that matters here, so it gets the final say.
    if (next !== sheetState) dragged.current = true;
    setSheetState(next);
  };

  // A cancel is the BROWSER taking the gesture over, not the student letting go
  // — the only outcome is "put it back". A cancelled drag produces no click, so
  // the flag has nothing to suppress; left set it would eat the NEXT real tap.
  const onPointerCancel = () => {
    start.current = null;
    setDragHeight(null);
    dragged.current = false;
  };

  /**
   * A drag ends in a click on whatever was under the finger — which, now that
   * the sheet can show an event card, could cast an RSVP, clear the selection or
   * follow a link as a side effect of collapsing.
   *
   * Swallowed once in the capture phase rather than per control, so nothing
   * inside the sheet needs to know about dragging.
   */
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * The whole sheet is a drag surface, not just the handle — dragging a sheet
   * down anywhere on it is what every native sheet does.
   *
   * This needs a NON-PASSIVE touchmove: React attaches touch listeners
   * passively, so `preventDefault` from onPointerMove is a no-op and the browser
   * takes the gesture as a pan and fires pointercancel mid-drag. Only while the
   * sheet is actually absorbing the travel — otherwise this would block the Akce
   * list from ever scrolling.
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
  }, [sheetState, panelRef]);

  /**
   * For controls that must not fire when the gesture was a drag. The capture
   * handler already swallows those clicks, so this is the belt to its braces —
   * kept because the handle and tabs have always guarded themselves.
   */
  const consumeDragClick = () => {
    if (!dragged.current) return false;
    dragged.current = false;
    return true;
  };

  return {
    dragHeight,
    consumeDragClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
