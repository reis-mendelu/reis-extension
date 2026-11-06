import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react';

/** Movement past this many CSS px is a scroll or a drag, not a hold. */
const SLOP = 10;

/**
 * A press held for `ms`, by finger or mouse. The hidden door into the admin
 * console (spec 2026-10-08): societies no longer self-post, so the console left
 * Profile, and "hold your name" is easy to tell the few people who need it.
 * A Týden or Den lesson opens its hide menu the same way (2026-11-06).
 *
 * Two rules a hold on a TAPPABLE target needs:
 * - The click that ends a hold is swallowed, or lifting the finger would also
 *   do the tap. Swallowed on the WINDOW, not the target: what the hold opened
 *   is under the finger by then, and a touch's click goes to whatever is there
 *   at the lift — a sheet's backdrop, which closed the sheet the hold had just
 *   opened (CDP touch, 2026-11-06). Only that one click, and only briefly.
 * - A second finger anywhere cancels it: two fingers resting before a spread
 *   are a pinch (usePinchView), not a hold. The second finger usually lands on
 *   another element, so it is heard on the window, not on the target.
 */
export function useLongPress(onLongPress: () => void, ms = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const touch = useRef(false);
  const unlisten = useRef<(() => void) | null>(null);
  const unswallow = useRef<(() => void) | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    unlisten.current?.();
    unlisten.current = null;
  };
  // Unmounting cancels a pending hold but NOT an armed swallow: the hold's own
  // action may unmount this (holding the name swaps App for AdminConsole), and
  // the lift's click would then land on whatever replaced it. The swallow ends
  // itself on that click, the next press, or after a second (PR #638 review).
  useEffect(() => cancel, []);

  const swallowNextClick = () => {
    const swallow = (e: globalThis.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
    };
    const stop = () => {
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('pointerdown', stop, true);
      clearTimeout(timeout);
      unswallow.current = null;
    };
    // A click that has not come by then is not this gesture's.
    const timeout = setTimeout(stop, 1000);
    window.addEventListener('click', swallow, true);
    // The next press starts a new gesture: its click is a real tap.
    window.addEventListener('pointerdown', stop, true);
    unswallow.current = stop;
  };

  const listenForSecondFinger = (pointerId: number) => {
    const onPointer = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) cancel();
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) cancel();
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('touchstart', onTouch, true);
    unlisten.current = () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('touchstart', onTouch, true);
    };
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      // A second finger is a pinch, never a hold of its own — on this target
      // or another one (PR #638 review). Its arrival cancels the first, via
      // the window listener below.
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      cancel();
      unswallow.current?.();
      touch.current = e.pointerType === 'touch';
      origin.current = { x: e.clientX, y: e.clientY };
      listenForSecondFinger(e.pointerId);
      timer.current = setTimeout(() => {
        timer.current = null;
        cancel();
        swallowNextClick();
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // iOS/Android open a text-selection callout on a held name; the hold is
    // ours. Touch only: a desktop right-click keeps its menu.
    onContextMenu: (e: MouseEvent) => {
      if (touch.current) e.preventDefault();
    },
  };
}
