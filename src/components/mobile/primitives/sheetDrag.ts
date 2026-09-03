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

/** Past this much travel the map sheet changes detent regardless of speed. */
export const DETENT_DISTANCE_PX = 64;

/**
 * How far a finger must move before the gesture counts as a DRAG rather than a
 * tap, for the purpose of suppressing the click it ends in.
 *
 * `consumesTravel` is true for a single pixel in the absorbing direction, which
 * is right for moving the sheet — it should track the finger immediately — but
 * wrong for deciding a tap was really a drag. Fingers jitter, so without this a
 * plain tap on a card, an RSVP or a tab is intermittently swallowed.
 */
export const DRAG_SLOP_PX = 8;

/**
 * The map sheet's stops, shortest first.
 *
 * Three, not two. The campus events used to sit in a 166px peek that showed a
 * summary line and nothing else, so seeing what was on meant dragging the sheet
 * up over the map every single time — reported as "the campus events need to be
 * pulled up while looking at the map ... to be directly visible", with a
 * screenshot of a peek band that was simply blank under its title. `half` shows
 * events AND keeps the map in view, and it is where the sheet opens.
 */
export const DETENTS = ['peek', 'half', 'expanded'] as const;

export type Detent = (typeof DETENTS)[number];

/**
 * The next stop in the direction the finger is travelling, or null at the ends.
 *
 * Negative `dy` is upward, which means taller. One step per gesture is what
 * makes a middle stop reachable at all: jumping peek→expanded would skip it.
 */
function neighbour(from: Detent, dy: number): Detent | null {
  if (dy === 0) return null;
  const index = DETENTS.indexOf(from) + (dy < 0 ? 1 : -1);
  return DETENTS[index] ?? null;
}

/**
 * Whether the sheet can absorb travel in this direction from this stop.
 *
 * At either end one direction is against the stop, and the gesture belongs to
 * whatever is under the finger (usually the Akce list scrolling). The middle
 * stop absorbs both ways.
 */
export function consumesTravel(from: Detent, dy: number): boolean {
  return neighbour(from, dy) !== null;
}

/**
 * Where the sheet lands when the finger lifts.
 *
 * The map sheet never closes — it moves between stops — so it needs the
 * dismissal rules mirrored to work upward as well. `shouldDismiss` cannot serve
 * here: it ignores upward travel by design, which is exactly the "I cannot pull
 * it up" half.
 *
 * Travel deeper into the stop already held is ignored rather than clamped
 * later: peek is the floor, and dragging down from it must not collapse the
 * sheet out of existence, since the sheet is the only way to reach Akce.
 */
export function snapDetent(from: Detent, dy: number, dtMs: number): Detent {
  const target = neighbour(from, dy);
  if (!target) return from;
  const travel = Math.abs(dy);
  if (travel >= DETENT_DISTANCE_PX) return target;
  return dtMs > 0 && travel / dtMs >= DISMISS_VELOCITY_PX_PER_MS ? target : from;
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
