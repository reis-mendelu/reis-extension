import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react';

/** Movement past this many CSS px is a scroll or a drag, not a hold. */
const SLOP = 10;

/**
 * A press held for `ms`, by finger or mouse. The hidden door into the admin
 * console (spec 2026-10-08): societies no longer self-post, so the console left
 * Profile, and "hold your name" is easy to tell the few people who need it.
 */
export function useLongPress(onLongPress: () => void, ms = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  useEffect(() => cancel, []);
  return {
    onPointerDown: (e: PointerEvent) => {
      cancel();
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
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
    // iOS/Android open a text-selection callout on a held name; the hold is ours.
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}
