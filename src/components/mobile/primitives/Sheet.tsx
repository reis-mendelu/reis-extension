import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { dragOwnsGesture, shouldDismiss } from './sheetDrag';

export interface SheetProps {
  /** `full` pins below the status area and scrolls; `content` hugs the bottom. */
  size: 'full' | 'content';
  onClose: () => void;
  children: ReactNode;
  /** Raises the sheet above other sheets (confirm dialogs). */
  elevated?: boolean;
  /**
   * `screen` presents a pushed screen rather than a bottom sheet: full bleed,
   * no backdrop, slide in from the right, and no drag-to-dismiss. It stays in
   * the same sheet STACK — back still pops it — only the presentation differs.
   * Defaults to `sheet` so the other callers are untouched.
   */
  variant?: 'sheet' | 'screen';
}

/**
 * The one bottom-sheet container. Nine sheets share this exact behaviour:
 * backdrop fade, slide-up, tap-outside-to-close, drag-down-to-close, and one of
 * two heights.
 */
export function Sheet({ size, onClose, children, elevated, variant = 'sheet' }: SheetProps) {
  const isScreen = variant === 'screen';
  // ONE z-index for the whole sheet, backdrop and panel alike. Within a sheet
  // the panel is the later sibling, so it still paints over its own backdrop —
  // and across sheets, `SheetHost` renders the stack as siblings in stack
  // order, so DOM order alone lays them correctly however deep the stack goes.
  //
  // Numbering the two layers separately (backdrop z-50, panel z-[51]) is the
  // right relationship inside one sheet and the wrong one across two: a sheet
  // pushed on top got a z-50 backdrop that painted UNDER the z-[51] panel of
  // the sheet below, because z-index beats DOM order. That left the lower sheet
  // undimmed and still tappable — with documents open over settings, tapping
  // the eduroam row it should have covered pushed a third sheet and slid
  // eduroam up over documents instead of replacing it. Under the subject
  // drawer (variant="screen", which covers `inset-0`) the backdrop was hidden
  // outright, so a person card opened from the classmates strip read as one
  // continuous surface with the drawer behind it.
  //
  // Tailwind's default z-index scale stops at 50 — z-60 is not a real class
  // and would silently drop the stacking order, so `elevated` needs an
  // arbitrary value. z-50 is on-scale and stays as-is.
  const layerZ = elevated ? 'z-[60]' : 'z-50';
  // A screen covers everything and carries its own status-bar inset; the sheet
  // sizes leave the strip above them visible on purpose.
  const panelPosition = isScreen
    ? 'inset-0 pt-[var(--safe-top,0px)]'
    : size === 'full'
      ? 'top-[70px] bottom-0'
      : 'bottom-0 max-h-[85dvh]';

  const panelRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A screen is left via back, not by being thrown downward — and with no
    // backdrop there is nothing to tap outside of, so an accidental dismissal
    // would have no undo.
    if (isScreen) return;
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

  // Not onPointerUp: a cancel is the BROWSER taking the gesture over (a pan it
  // decided to own, a system edge swipe), not the student letting go. Running
  // the dismiss decision on it closes the sheet mid-drag — a 30px cancel inside
  // 50ms reads as a dismissing flick by velocity alone. A cancelled drag has no
  // outcome but "put it back".
  const onPointerCancel = () => {
    start.current = null;
    setDragY(0);
  };

  const dragging = dragY > 0;

  return (
    <>
      {!isScreen && (
        <div
          data-testid="sheet-backdrop"
          onClick={onClose}
          className={`absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out] ${layerZ}`}
        />
      )}
      <div
        ref={panelRef}
        data-testid="sheet-panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // The entry animation is dropped the moment a drag starts: it animates
        // the same transform this does, and leaving both on makes the sheet
        // fight the finger.
        // A screen enters from the RIGHT and squares off its corners: a rounded
        // top edge sliding up is the vocabulary of something temporary sitting
        // over the page, which is exactly the impression to avoid here.
        // The hairline goes with that rounded edge, and only there. Sheets stack
        // — a classmate tapped inside the subject drawer opens a PersonSheet over
        // a sheet that is already up — and both panels are bg-base-100 while
        // `--shadow-drawer` casts DOWNWARD (`0 20px 25px -5px`), contributing
        // nothing at a bottom sheet's TOP edge. The two surfaces met with no seam
        // and read as one continuous background. A screen needs no line: it is
        // full-bleed against the viewport, where that is not a seam between two
        // surfaces but a stripe under the status bar.
        // base-content/15 rather than base-300, MEASURED on the device theme:
        // base-300 (#0f172a) against a base-100 (#1f2937) panel sitting on a
        // base-100 sheet is 1.22:1 — a line technically present and practically
        // not there. The same 15% tint the composer's ghost buttons use reads
        // 1.57:1 on dark, and is a dark line on light, so one token separates
        // the surfaces in both themes.
        className={`absolute ${isScreen ? '' : 'inset-x-0'} ${panelPosition} ${layerZ} flex flex-col overflow-hidden bg-base-100 shadow-drawer ${
          isScreen
            ? 'animate-[screenIn_0.25s_ease-out]'
            : 'rounded-t-[20px] border-t border-base-content/15'
        } ${dragging || isScreen ? '' : 'animate-[sheetUp_0.3s_ease-out]'}`}
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
