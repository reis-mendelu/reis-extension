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

/**
 * Past this much UPWARD speed at release, the student is pulling the sheet
 * back and it must stay however far down it had travelled.
 *
 * Not zero: a finger lifting off a touchscreen drifts a pixel or two, and
 * treating any upward twitch as "they changed their mind" would make a
 * deliberate long drag fail at random.
 */
export const REVERSAL_VELOCITY_PX_PER_MS = -0.05;

/** How much of the end of a gesture counts towards its release velocity. */
export const VELOCITY_WINDOW_MS = 100;

/**
 * One point along a gesture: how far along the axis, and when.
 *
 * `pos` rather than `y` because the measurement below is the same on either
 * axis — the day strip's horizontal week swipe wants exactly this, and a field
 * called `y` would have meant either a second copy of the function or storing
 * an x in a field named y.
 */
export interface DragSample {
  pos: number;
  t: number;
}

/**
 * Release velocity in px/ms along the sample axis, from the END of the gesture.
 * Positive is increasing `pos` — downward for a sheet, rightward for a strip.
 *
 * Averaging over the WHOLE gesture — which is what `dy / dtMs` did — answers a
 * different question than the one that matters. A long slow pull that finishes
 * with a flick averages out to slow and would snap back; a sheet held still for
 * a second and then nudged averages to nearly nothing. What decides where a
 * sheet should land is how fast it was moving when it was let go, so only the
 * last `VELOCITY_WINDOW_MS` counts.
 */
export function releaseVelocity(samples: readonly DragSample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1] as DragSample;
  // The oldest sample still inside the window, so a slow gesture with sparse
  // samples still has two points to measure between.
  let first = samples[samples.length - 2] as DragSample;
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i] as DragSample;
    if (last.t - s.t > VELOCITY_WINDOW_MS) break;
    first = s;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.pos - first.pos) / dt;
}

/**
 * Whether a released bottom sheet should close.
 *
 * Two ways in, and the second needs the guard: a fast downward flick closes
 * from anywhere, and a long drag closes UNLESS it was being pulled back at the
 * moment of release. Without that second clause, dragging down 120px, thinking
 * better of it, and flicking back up still dismissed — the distance had already
 * been travelled, so the sheet closed under a finger that was moving the other
 * way.
 */
export function shouldDismiss(dy: number, velocity: number): boolean {
  // Upward and sideways drags never dismiss; the sheet is anchored at the bottom.
  if (dy <= 0) return false;
  if (velocity >= DISMISS_VELOCITY_PX_PER_MS) return true;
  return dy >= DISMISS_DISTANCE_PX && velocity > REVERSAL_VELOCITY_PX_PER_MS;
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
 *
 * `velocity` is the RELEASE velocity in px/ms, downward positive — the same
 * measure `shouldDismiss` takes, from the same `releaseVelocity`. It used to be
 * the gesture's duration, and the two clauses below are `shouldDismiss`'s
 * mirrored onto a ladder that travels both ways, reversal guard included: a
 * long pull that is being pushed back at the moment of release stays where it
 * was, rather than landing on a stop the finger had already changed its mind
 * about.
 */
export function snapDetent(from: Detent, dy: number, velocity: number): Detent {
  const target = neighbour(from, dy);
  if (!target) return from;
  // Speed in the direction of TRAVEL, so one threshold serves both rungs.
  const towards = dy < 0 ? -velocity : velocity;
  if (towards >= DISMISS_VELOCITY_PX_PER_MS) return target;
  return Math.abs(dy) >= DETENT_DISTANCE_PX && towards > REVERSAL_VELOCITY_PX_PER_MS
    ? target
    : from;
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
