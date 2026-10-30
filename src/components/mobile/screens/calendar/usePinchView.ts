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

    // Only fingers that STARTED on the calendar count — one resting on the tab
    // bar plus one dragged on the calendar is not a pinch (release review). The
    // pair is then followed by identifier, not by where it is now: a finger
    // whose element is removed mid-gesture keeps its old, detached target
    // (#622 review).
    let pair: [number, number] | null = null;
    const onSurface = (e: TouchEvent) =>
      Array.from(e.touches).filter((t) => t.target instanceof Node && surface.contains(t.target));
    const byId = (e: TouchEvent, id: number) =>
      Array.from(e.touches).find((t) => t.identifier === id);

    // Exactly two fingers on the calendar set the baseline; any other count
    // drops it, so a third finger and its lift never leave an old pair behind.
    const baseline = (e: TouchEvent) => {
      const [a, b, extra] = onSurface(e);
      const ok = a && b && !extra && e.touches.length === 2;
      pair = ok ? [a.identifier, b.identifier] : null;
      from = ok ? distance(a, b) : null;
      fired = false;
    };
    const onStart = baseline;
    const onMove = (e: TouchEvent) => {
      if (from === null || pair === null || fired || e.touches.length !== 2 || from === 0) return;
      const a = byId(e, pair[0]);
      const b = byId(e, pair[1]);
      if (!a || !b) return;
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
    // A lift that leaves two fingers starts a fresh pinch from them.
    const onEnd = baseline;
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
