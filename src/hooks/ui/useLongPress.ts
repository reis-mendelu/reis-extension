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
 *   do the tap (open the subject over the hide menu). Only that one click.
 * - A second finger anywhere cancels it: two fingers resting before a spread
 *   are a pinch (usePinchView), not a hold. The second finger usually lands on
 *   another element, so it is heard on the window, not on the target.
 */
export function useLongPress(onLongPress: () => void, ms = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const touch = useRef(false);
  const held = useRef(false);
  const unlisten = useRef<(() => void) | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    unlisten.current?.();
    unlisten.current = null;
  };
  useEffect(() => cancel, []);

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
      cancel();
      held.current = false;
      touch.current = e.pointerType === 'touch';
      origin.current = { x: e.clientX, y: e.clientY };
      listenForSecondFinger(e.pointerId);
      timer.current = setTimeout(() => {
        timer.current = null;
        cancel();
        held.current = true;
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
    onClickCapture: (e: MouseEvent) => {
      if (!held.current) return;
      held.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // iOS/Android open a text-selection callout on a held name; the hold is
    // ours. Touch only: a desktop right-click keeps its menu.
    onContextMenu: (e: MouseEvent) => {
      if (touch.current) e.preventDefault();
    },
  };
}
