import { useEffect, useRef, type RefObject } from 'react';

/** Fingers closing to this share of where they started: zoom out to Týden. */
export const PINCH_IN_SCALE = 0.8;
/** Fingers opening to this share of where they started: zoom into a day. */
export const SPREAD_SCALE = 1.25;

export interface PinchViewConfig {
  /** The whole calendar screen: a pinch may start anywhere on it. */
  surfaceRef: RefObject<HTMLElement | null>;
  /** Den only: the fingers closed. */
  onPinchIn?: () => void;
  /** Týden only: the fingers opened, around this point. */
  onSpread?: (point: { x: number; y: number }) => void;
}

const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/**
 * Zoom between Den and Týden with two fingers (spec 2026-10-30, decision 3) —
 * a shortcut on top of the icon switch, never the only way to it.
 *
 * Touch events, passive, like usePullToRefresh: one finger stays the pull and
 * the sideways swipe (both stand down on a second finger), and nothing here
 * takes the gesture from the browser. It fires once per gesture, past a
 * threshold well clear of a two-finger wobble.
 *
 * The one thing it does block is iOS's own page zoom (`gesturestart`), which
 * WKWebView may still offer although the viewport says `user-scalable=no`:
 * the calendar would otherwise zoom AND switch.
 */
export function usePinchView({ surfaceRef, onPinchIn, onSpread }: PinchViewConfig) {
  // The latest handlers, without re-binding the listeners on every render.
  const handlers = useRef({ onPinchIn, onSpread });
  useEffect(() => {
    handlers.current = { onPinchIn, onSpread };
  }, [onPinchIn, onSpread]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    let from: number | null = null;
    let fired = false;

    const onStart = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      if (e.touches.length !== 2 || !a || !b) return;
      from = distance(a, b);
      fired = false;
    };
    const onMove = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      if (from === null || fired || e.touches.length !== 2 || !a || !b || from === 0) return;
      const scale = distance(a, b) / from;
      const { onPinchIn: pinchIn, onSpread: spread } = handlers.current;
      if (scale <= PINCH_IN_SCALE && pinchIn) {
        fired = true;
        pinchIn();
      } else if (scale >= SPREAD_SCALE && spread) {
        fired = true;
        spread({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) from = null;
    };
    const blockPageZoom = (e: Event) => e.preventDefault();

    surface.addEventListener('touchstart', onStart, { passive: true });
    surface.addEventListener('touchmove', onMove, { passive: true });
    surface.addEventListener('touchend', onEnd, { passive: true });
    surface.addEventListener('touchcancel', onEnd, { passive: true });
    surface.addEventListener('gesturestart', blockPageZoom, { passive: false });
    return () => {
      surface.removeEventListener('touchstart', onStart);
      surface.removeEventListener('touchmove', onMove);
      surface.removeEventListener('touchend', onEnd);
      surface.removeEventListener('touchcancel', onEnd);
      surface.removeEventListener('gesturestart', blockPageZoom);
    };
  }, [surfaceRef]);
}

/** The Týden day column under a point, by its `data-day-iso`. */
export function dayIsoAt(point: { x: number; y: number }): string | null {
  const el = document.elementFromPoint(point.x, point.y);
  return el?.closest('[data-day-iso]')?.getAttribute('data-day-iso') ?? null;
}
