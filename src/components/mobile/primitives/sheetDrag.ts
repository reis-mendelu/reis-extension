/**
 * The drag-to-dismiss decision for mobile bottom sheets, kept pure so the rules
 * are testable without a touchscreen.
 *
 * The nine mobile sheets render through `Sheet`, which had a backdrop, a
 * slide-up animation and tap-outside-to-close — but no drag handling at all.
 * Swiping a sheet down did nothing, which reads as "the app is frozen" rather
 * than "this gesture is unimplemented".
 */

/** Past this much downward travel the sheet closes regardless of speed. */
export const DISMISS_DISTANCE_PX = 96;

/** A short, fast flick should close too — this is the px/ms that counts as one. */
export const DISMISS_VELOCITY_PX_PER_MS = 0.5;

export function shouldDismiss(dy: number, dtMs: number): boolean {
  // Upward and sideways drags never dismiss; the sheet is anchored at the bottom.
  if (dy <= 0) return false;
  if (dy >= DISMISS_DISTANCE_PX) return true;
  return dtMs > 0 && dy / dtMs >= DISMISS_VELOCITY_PX_PER_MS;
}

/**
 * Whether a downward drag starting on `target` should move the SHEET rather
 * than scroll the content under the finger.
 *
 * Scrolling wins whenever the content can still scroll up, so a student reading
 * halfway down a 20-file list never loses the sheet by swiping down. Only at the
 * very top of the scroll does the same gesture become a dismiss — the behaviour
 * every native sheet has.
 *
 * `stopAt` bounds the walk to the sheet panel so an ancestor outside it can
 * never veto the gesture.
 */
export function dragOwnsGesture(target: Element | null, stopAt: Element | null): boolean {
  let node: Element | null = target;
  while (node && node !== stopAt?.parentElement) {
    if (isScrollable(node) && node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return true;
}

function isScrollable(el: Element): boolean {
  // scrollHeight > clientHeight alone is not enough: a tall element inside a
  // non-scrolling parent reports that too, and treating it as a scroller would
  // silently disable dismissal on sheets whose content merely overflows.
  const overflowY = getComputedStyle(el).overflowY;
  return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
}
