import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { releaseVelocity, DRAG_SLOP_PX, type DragSample } from '../../primitives/sheetDrag';
import { weekSwipeSteps, isHorizontal } from './weekSwipe';

export interface WeekSwipeConfig {
  /** The strip being swiped. Pointer capture and the touch claim scope to it. */
  stripRef: RefObject<HTMLElement | null>;
  /** Live travel, so the strip can follow the finger. */
  onMove: (dx: number) => void;
  /** Move this many weeks (-1, 0 or +1) and settle. */
  onEnd: (steps: -1 | 0 | 1) => void;
  /** The browser took the gesture. Put the strip back. */
  onCancel: () => void;
}

/**
 * Swiping the day strip to change week.
 *
 * A sibling to `useSheetDrag` rather than an axis parameter on it. The sheet
 * hook reports one number, `dy`, and every one of its callers is a
 * bottom-anchored sheet whose behaviour has been verified on device; widening
 * it to two dimensions for the single caller that needs the other axis would
 * put that path at risk to save a file. What IS shared is the part worth
 * sharing: the windowed `releaseVelocity`, the slop, and the reversal rule,
 * all imported.
 *
 * The one thing this has that the sheets do not is AXIS ARBITRATION. A sheet
 * owns every downward drag that starts on it; the strip sits directly above a
 * scrolling agenda, so it has to decide, mid-gesture, whether a finger is
 * changing week or scrolling the day. `isHorizontal` decides once — at the
 * first movement past the slop — and the answer holds for the rest of the
 * gesture. Re-deciding every frame meant a swipe that drifted downward at the
 * end handed the tail of itself back to the page.
 */
export function useWeekSwipe({ stripRef, onMove, onEnd, onCancel }: WeekSwipeConfig) {
  /**
   * The gesture in progress, including WHICH pointer owns it.
   *
   * The same defect `useSheetDrag` was reviewed for lives here by construction:
   * without the id, a second finger landing mid-swipe re-anchors the gesture to
   * itself and lifting the first finger changes week from travel nobody made.
   * Fixed in both rather than only where it was spotted.
   */
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const samples = useRef<DragSample[]>([]);
  /** null until the slop is passed, then true for "ours" and false for "the page's". */
  const owned = useRef<boolean | null>(null);
  /** Whether this gesture moved the strip, so its trailing click must be eaten. */
  const dragged = useRef(false);

  const reset = () => {
    start.current = null;
    samples.current = [];
    owned.current = null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    // A swipe already in flight keeps the strip; a second finger is not a new
    // gesture and must not clear the click-suppression flag either.
    if (start.current) return;
    dragged.current = false;
    reset();
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    samples.current = [{ pos: e.clientX, t: e.timeStamp }];
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const from = start.current;
    if (!from || from.id !== e.pointerId) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;

    if (owned.current === null) {
      // Nothing is decided inside the slop: a tap on a chip jitters by a pixel
      // or two, and calling that a swipe would make the chips unselectable.
      if (Math.abs(dx) < DRAG_SLOP_PX && Math.abs(dy) < DRAG_SLOP_PX) return;
      owned.current = isHorizontal(dx, dy);
      if (!owned.current) {
        // The page's gesture. Forget it entirely rather than watching it, so no
        // later frame can change the answer.
        reset();
        return;
      }
      // Claimed only now, and only for a gesture we are keeping — capturing on
      // pointerdown would steal the taps too.
      stripRef.current?.setPointerCapture?.(e.pointerId);
    }

    dragged.current = true;
    samples.current.push({ pos: e.clientX, t: e.timeStamp });
    if (samples.current.length > 24) samples.current.shift();
    onMove(dx);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const from = start.current;
    if (from && from.id !== e.pointerId) return;
    const wasOurs = owned.current === true;
    // MEASURED BEFORE THE STATE IS CLEARED. `reset()` used to run first, which
    // emptied this buffer, so the `releaseVelocity` below saw the single
    // closing sample and returned 0 — and a velocity of 0 leaves the distance
    // clause deciding every swipe on its own, with the reversal guard dead.
    // Dragging the strip past the threshold and pushing back before letting go
    // still changed the week. Found by driving the real strip in the browser;
    // the pure rules were right all along and never saw a real number.
    const released = wasOurs ? [...samples.current, { pos: e.clientX, t: e.timeStamp }] : [];
    reset();
    if (stripRef.current?.hasPointerCapture?.(e.pointerId))
      stripRef.current?.releasePointerCapture?.(e.pointerId);
    if (!from || !wasOurs) return onEnd(0);
    onEnd(weekSwipeSteps(e.clientX - from.x, releaseVelocity(released)));
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (start.current && start.current.id !== e.pointerId) return;
    reset();
    if (stripRef.current?.hasPointerCapture?.(e.pointerId))
      stripRef.current?.releasePointerCapture?.(e.pointerId);
    dragged.current = false;
    onCancel();
  };

  /**
   * A swipe ends in a click on whichever chip is under the finger, which would
   * select a day in the week the student just swiped away from. Swallowed once,
   * in the capture phase, before the chip's own handler runs.
   */
  const onClickCapture = (e: ReactMouseEvent<HTMLElement>) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * React attaches touch listeners passively, so `preventDefault` from a React
   * handler is a no-op and the browser is free to decide partway through that
   * this is a page pan — it then fires `pointercancel` and the swipe dies. The
   * sheets learned this on device, where a 350px drag was cut off after ~20px.
   * Only a manual non-passive listener can hold the gesture, and it holds it
   * only once the arbitration above has said the gesture is ours.
   */
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onTouchMove = (e: TouchEvent) => {
      if (owned.current !== true) return;
      e.preventDefault();
    };
    strip.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => strip.removeEventListener('touchmove', onTouchMove);
  }, [stripRef]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
