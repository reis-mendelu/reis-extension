import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Drag the tablet rail's left edge to resize it.
 *
 * Pointer events rather than mouse/touch pairs, and `setPointerCapture` rather
 * than window listeners: the pointer leaves the 12px strip on the first frame
 * of any real drag, and capture is what keeps the events coming to the element
 * that started it — the same reason the phone sheet's drag hook captures.
 *
 * The width itself is clamped in the store action, so this only has to report
 * where the finger is. `touch-none` on the strip stops the browser claiming the
 * gesture as a page pan partway through, which on the phone sheet was measured
 * cutting a 350px swipe off after ~20px.
 */
export function useRailResize() {
  const setRailWidth = useAppStore((s) => s.setMapRailWidth);
  const [resizing, setResizing] = useState(false);
  const activeRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activeRef.current = true;
    setResizing(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeRef.current) return;
      // The rail is anchored to the right, so its width is the distance from
      // the pointer to its right edge — read from the panel, not remembered
      // from pointerdown, so a window resize mid-drag cannot skew it.
      const panel = e.currentTarget.parentElement;
      if (!panel) return;
      setRailWidth(panel.getBoundingClientRect().right - e.clientX);
    },
    [setRailWidth]
  );

  const end = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setResizing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return {
    resizing,
    railHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
