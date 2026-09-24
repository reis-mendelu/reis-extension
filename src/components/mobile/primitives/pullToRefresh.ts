import { isHorizontal } from '../screens/calendar/weekSwipe';
import { DRAG_SLOP_PX } from './sheetDrag';

/**
 * The rules of a pull-to-refresh, kept apart from the DOM so they can be read
 * — and argued with — without a touch device in hand.
 */

/**
 * Past this much downward travel a release refreshes. The same 64px the day
 * and week swipes need to change anything, so every deliberate gesture on the
 * calendar costs the same distance.
 */
export const PULL_REFRESH_THRESHOLD_PX = 64;

/** How far the indicator travels in from above while it fades in. */
export const PULL_INDICATOR_TRAVEL_PX = 24;

/**
 * Who owns a gesture, decided once at the slop and never again.
 *
 * `null` inside the slop: a tap on a lesson row jitters by a pixel or two.
 * Past it, the pull takes only a finger going DOWN more than it goes sideways.
 * The sideways test is `isHorizontal`, the one the day swipe itself uses, so
 * there is no diagonal that both gestures claim or both refuse. Upward is a
 * scroll, which the page keeps.
 */
export function pullClaims(dx: number, dy: number): boolean | null {
  if (Math.abs(dx) < DRAG_SLOP_PX && Math.abs(dy) < DRAG_SLOP_PX) return null;
  return dy > 0 && !isHorizontal(dx, dy);
}

/**
 * Where the indicator sits and how opaque it is for a pull of `dy` px: it fades
 * in and slides down to its resting place exactly at the threshold, so "fully
 * visible" and "letting go now refreshes" are the same moment. The glyph turns
 * with the travel, so the finger visibly winds something up.
 */
export function pullIndicatorFrame(dy: number): { opacity: number; y: number; deg: number } {
  const progress = Math.min(Math.max(dy, 0) / PULL_REFRESH_THRESHOLD_PX, 1);
  return {
    opacity: progress,
    y: (progress - 1) * PULL_INDICATOR_TRAVEL_PX,
    deg: Math.max(dy, 0) * 3,
  };
}
