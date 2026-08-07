import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { dragOwnsGesture, shouldDismiss } from './sheetDrag';

export interface SheetProps {
  /** `full` pins below the status area and scrolls; `content` hugs the bottom. */
  size: 'full' | 'content';
  onClose: () => void;
  children: ReactNode;
  /** Raises the sheet above other sheets (confirm dialogs). */
  elevated?: boolean;
}

/**
 * The one bottom-sheet container. Nine sheets share this exact behaviour:
 * backdrop fade, slide-up, tap-outside-to-close, drag-down-to-close, and one of
 * two heights.
 */
export function Sheet({ size, onClose, children, elevated }: SheetProps) {
  // Tailwind's default z-index scale stops at 50 — z-60/z-61 are not real
  // classes and would silently drop the sheet's stacking order. z-50 is
  // on-scale and stays as-is; anything above it (51, 60, 61) needs an
  // arbitrary value.
  const backdropZ = elevated ? 'z-[60]' : 'z-50';
  const panelZ = elevated ? 'z-[61]' : 'z-[51]';
  const panelPosition = size === 'full' ? 'top-[70px] bottom-0' : 'bottom-0 max-h-[85dvh]';

  const panelRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only a gesture the content does not want. dragOwnsGesture returns false
    // while any scroller under the finger is scrolled past its top, so reading
    // a long list never costs the student their place.
    if (!dragOwnsGesture(e.target as Element, panelRef.current)) return;
    start.current = { y: e.clientY, t: e.timeStamp };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    // Clamped at 0: the sheet is bottom-anchored, so upward drag has nowhere to
    // travel and rubber-banding it would only suggest it does.
    setDragY(dy > 0 ? dy : 0);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    if (!from) return;
    if (shouldDismiss(e.clientY - from.y, e.timeStamp - from.t)) {
      onClose();
      return;
    }
    setDragY(0);
  };

  const dragging = dragY > 0;

  return (
    <>
      <div
        data-testid="sheet-backdrop"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out] ${backdropZ}`}
      />
      <div
        ref={panelRef}
        data-testid="sheet-panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // The entry animation is dropped the moment a drag starts: it animates
        // the same transform this does, and leaving both on makes the sheet
        // fight the finger.
        className={`absolute inset-x-0 ${panelPosition} ${panelZ} flex flex-col overflow-hidden rounded-t-[20px] bg-base-100 shadow-drawer ${
          dragging ? '' : 'animate-[sheetUp_0.3s_ease-out]'
        }`}
        style={
          dragging
            ? { transform: `translateY(${dragY}px)` }
            : // No transition while idle, so releasing below the threshold snaps
              // back under this rule rather than lingering mid-screen.
              { transition: 'transform 0.2s ease-out' }
        }
      >
        {children}
      </div>
    </>
  );
}
