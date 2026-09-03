import {
  DISMISS_VELOCITY_PX_PER_MS,
  REVERSAL_VELOCITY_PX_PER_MS,
} from '../../primitives/sheetDrag';

/**
 * Which week a swipe across the day strip lands on.
 *
 * The strip is a horizontal row of days, and the gesture a horizontal row of
 * days invites is a horizontal swipe — but it did nothing, so the only route to
 * next week was a 28px chevron: "switching to the next week in the calendar has
 * a small '>' button. It feels a bit unintuitive."
 *
 * The rules are the ones the sheet drag arrived at, turned on their side, and
 * the shared parts are imported rather than restated. `DISMISS_VELOCITY_PX_PER_MS`
 * keeps its name here even though nothing is being dismissed: it is the
 * threshold at which a release counts as a flick rather than a drag, and one
 * number for every gesture in the app is worth more than a well-named copy of
 * it.
 */

/** Past this much horizontal travel the week changes regardless of speed. */
export const WEEK_SWIPE_DISTANCE_PX = 64;

/**
 * How much steeper than horizontal a swipe may be before it belongs to the
 * page instead.
 *
 * The strip sits directly above a scrolling agenda, so a finger starting on a
 * chip and moving mostly DOWN is someone scrolling the day's lessons, not
 * changing week. Requiring the horizontal component to lead by this factor is
 * what keeps the two apart — without it a lazy diagonal scroll would jump a
 * week on the way past.
 */
export const HORIZONTAL_BIAS = 1.5;

export function isHorizontal(dx: number, dy: number): boolean {
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS;
}

/**
 * How many weeks to move: -1 for back, +1 for forward, 0 to stay.
 *
 * One week per gesture, whatever the distance — the same rule as the map
 * sheet's detent ladder, and for the same reason: a strip that jumps three
 * weeks on one long drag cannot be aimed. A student wanting week 12 swipes
 * four times, and each swipe is legible.
 *
 * Direction is inverted from the travel, because the strip follows the finger:
 * dragging LEFT pulls next week into view, the way every paged carousel and
 * the native calendars behave.
 *
 * `velocity` is the RELEASE velocity in px/ms from `releaseVelocity`, positive
 * rightward. The reversal guard is the sheet's: a swipe that has covered the
 * distance but is being pushed back at the moment of release stays put, so
 * changing your mind mid-gesture works instead of landing you a week away.
 */
export function weekSwipeSteps(dx: number, velocity: number): -1 | 0 | 1 {
  if (dx === 0) return 0;
  const forward = dx < 0;
  // Speed in the direction of travel, so one threshold serves both ways.
  const towards = forward ? -velocity : velocity;
  if (towards >= DISMISS_VELOCITY_PX_PER_MS) return forward ? 1 : -1;
  if (Math.abs(dx) >= WEEK_SWIPE_DISTANCE_PX && towards > REVERSAL_VELOCITY_PX_PER_MS)
    return forward ? 1 : -1;
  return 0;
}
