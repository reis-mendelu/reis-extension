import { useEffect, useRef, type RefObject } from 'react';
import { anchoredScroll, pinchScale, type Point } from './pinchZoom';

interface Gesture {
  startScale: number;
  startDistance: number;
  scale: number;
  /** Midpoint of the two fingers, in the pane's own coordinates. */
  focal: Point;
  scroll: { left: number; top: number };
}

interface PendingScroll {
  scroll: { left: number; top: number };
  /** Where the pane is when the fingers lift; it may have panned since the start. */
  current: { left: number; top: number };
  focal: Point;
  ratio: number;
}

const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/**
 * Two-finger pinch on the viewer's scroll pane.
 *
 * The app cannot lean on the browser for this: Capacitor switches the WebView's
 * own pinch-zoom off (iOS disables the scroll view's pinchGestureRecognizer,
 * Android leaves builtInZoomControls false), and turning it back on would zoom
 * the whole app — tab bar, sheet and all — not the page being read.
 *
 * While the fingers move, the rendered pages are only CSS-scaled around the
 * pinch midpoint, which the compositor does for free; re-rendering every canvas
 * sixty times a second is what pdf.js cannot do on a phone. Lifting a finger
 * commits the scale once, and the scroll is moved so the same spot of the page
 * stays under the fingers.
 */
export function usePinchZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  scale: number,
  setScale: (scale: number) => void
) {
  const scaleRef = useRef(scale);
  const pending = useRef<PendingScroll | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let gesture: Gesture | null = null;

    const clearPreview = () => {
      const content = contentRef.current;
      content?.style.removeProperty('transform');
      content?.style.removeProperty('transform-origin');
    };

    const onStart = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      if (e.touches.length !== 2 || !a || !b) return;
      const rect = el.getBoundingClientRect();
      gesture = {
        startScale: scaleRef.current,
        startDistance: distance(a, b),
        scale: scaleRef.current,
        focal: {
          x: (a.clientX + b.clientX) / 2 - rect.left,
          y: (a.clientY + b.clientY) / 2 - rect.top,
        },
        scroll: { left: el.scrollLeft, top: el.scrollTop },
      };
    };

    // Non-passive, and it has to be: React's onTouchMove is passive, so a
    // preventDefault there is ignored and a mobile browser zooms the page.
    const onMove = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      if (!gesture || e.touches.length !== 2 || !a || !b) return;
      e.preventDefault();
      gesture.scale = pinchScale(gesture.startScale, gesture.startDistance, distance(a, b));
      const content = contentRef.current;
      if (!content) return;
      const { focal, scroll } = gesture;
      content.style.transformOrigin = `${scroll.left + focal.x}px ${scroll.top + focal.y}px`;
      content.style.transform = `scale(${gesture.scale / gesture.startScale})`;
    };

    const onEnd = (e: TouchEvent) => {
      if (!gesture || e.touches.length >= 2) return;
      const done = gesture;
      gesture = null;
      clearPreview();
      if (done.scale === done.startScale) return;
      pending.current = {
        scroll: done.scroll,
        current: { left: el.scrollLeft, top: el.scrollTop },
        focal: done.focal,
        ratio: done.scale / done.startScale,
      };
      setScale(done.scale);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [containerRef, contentRef, setScale]);

  // A passive effect, not a layout one: react-pdf resizes each canvas in its
  // own effect, and children's effects run before this one. Here the scroll
  // range already fits the new scale, so the offset is not clamped short.
  useEffect(() => {
    const next = pending.current;
    const el = containerRef.current;
    if (!next || !el) return;
    pending.current = null;
    const { left, top } = anchoredScroll(next.scroll, next.current, next.focal, next.ratio);
    el.scrollLeft = left;
    el.scrollTop = top;
  }, [scale, containerRef]);
}
