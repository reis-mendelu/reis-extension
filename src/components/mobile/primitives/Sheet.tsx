import { useRef, useState, type ReactNode } from 'react';
import { shouldDismiss } from './sheetDrag';
import { useSheetDrag } from './useSheetDrag';

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
  /**
   * Whether this sheet has EVER been dragged. A latch, deliberately, and it is
   * never cleared.
   *
   * It only exists to take the entry animation off the panel, and a flag that
   * went false again on release re-added `animate-[sheetUp]` to an element that
   * was already on screen — so letting go of a drag that did not dismiss made
   * the sheet replay its 0.3s slide up from the bottom edge. A small pull and a
   * release is precisely "when I put my finger on it and then away, it starts
   * bugging", and it was there before this change too.
   *
   * The offset itself is NOT state: it is written straight to the node below.
   * In state it cost a React render for every pointermove, sixty times a second
   * on an iPad 8, for a transform the compositor could have taken on its own.
   * One render per sheet, measured, where there were twenty per gesture.
   */
  const [hasDragged, setHasDragged] = useState(false);

  /**
   * The gesture itself lives in `useSheetDrag`, shared with the map sheet.
   * There used to be two copies of this plumbing and each was missing a
   * different piece — this one had neither the non-passive touch claim nor
   * pointer capture, which is why "the slidedown bugs all the time, it's not
   * fluent" was true of every sheet except the map's. What is left here is the
   * only part that is this sheet's own business: a bottom sheet travels DOWN
   * and far enough means dismiss.
   */
  /**
   * Written imperatively; `null` restores the resting position.
   *
   * The transition is killed here rather than through a re-render, because a
   * re-render lands a frame late — for that frame the 200ms snap-back easing is
   * still on the element and animates the offset the finger just set, so the
   * sheet starts every drag lagging behind the touch. Clearing it back to `''`
   * on release hands the animation back to the class, which is what makes the
   * spring back to rest smooth.
   */
  const setOffset = (px: number | null) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (px === null) {
      // removeProperty, not `= ''`: `transition` is a shorthand, and assigning
      // the empty string to a shorthand leaves the old value in place in some
      // implementations — which would pin `transition: none` on the panel for
      // the rest of its life and make every later snap-back instant.
      panel.style.removeProperty('transition');
      panel.style.removeProperty('transform');
      return;
    }
    panel.style.transition = 'none';
    panel.style.transform = `translateY(${px}px)`;
  };

  const { handlers } = useSheetDrag({
    panelRef,
    // A screen is left via back, not by being thrown downward — and with no
    // backdrop there is nothing to tap outside of, so an accidental dismissal
    // would have no undo.
    disabled: isScreen,
    // Downward only, and this is load-bearing twice over. It stops the panel
    // following a finger where it has nowhere to travel — and inside the hook
    // it also gates the `preventDefault` that claims the touch. Without it
    // every upward swipe in a sheet is claimed by the panel, so the file list
    // in DocsSheet and the results in SearchSheet cannot be scrolled at all
    // from where they start. `dragOwnsGesture` does not cover that case: it
    // yields only once a scroller is already past its top.
    absorbs: (dy) => dy > 0,
    onMove: (dy) => {
      if (!hasDragged) setHasDragged(true);
      setOffset(dy);
    },
    onEnd: (dy, velocity) => {
      if (shouldDismiss(dy, velocity)) onClose();
      else setOffset(null);
    },
    onCancel: () => setOffset(null),
  });

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
        {...handlers}
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
        } ${hasDragged || isScreen ? '' : 'animate-[sheetUp_0.3s_ease-out]'} ${
          isScreen ? '' : 'transition-transform duration-200 ease-out'
        }`}
      >
        {children}
      </div>
    </>
  );
}
