import { pullIndicatorFrame } from './pullToRefresh';

/**
 * The pull hint: the list slides itself down and springs back, with the spinner
 * peeking out — once, ever, on the calendar.
 *
 * It is a REPLAY of a short real pull, not an illustration of one. The spinner's
 * peak comes from `pullIndicatorFrame` at the hint's depth, so it is exactly
 * the frame a finger 44px down would paint — the hint cannot drift into
 * promising a gesture that looks different from the real one.
 *
 * Shallower than the threshold on purpose: the spinner shows at ~70% and never
 * spins, because the hint is "this list pulls", not "this list is refreshing".
 */

/** Long enough for the screen to settle and the eye to land on the list first. */
export const PULL_HINT_DELAY_MS = 700;

/** Also the depth a running refresh holds the list at, so hint and refresh match. */
export const PULL_DEPTH_PX = 44;
const DEPTH_PX = PULL_DEPTH_PX;
export const DOWN_MS = 380;
const HOLD_MS = 220;
export const BACK_MS = 520;
export const PULL_HINT_DURATION_MS = DOWN_MS + HOLD_MS + BACK_MS;

const at = (ms: number) => ms / PULL_HINT_DURATION_MS;
export const DOWN = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
// A small overshoot on the way back: the list lands like something let go of.
export const BACK = 'cubic-bezier(0.34, 1.4, 0.64, 1)';

export function pullHintContentKeyframes(): Keyframe[] {
  return [
    { offset: 0, transform: 'translateY(0)', easing: DOWN },
    { offset: at(DOWN_MS), transform: `translateY(${DEPTH_PX}px)` },
    { offset: at(DOWN_MS + HOLD_MS), transform: `translateY(${DEPTH_PX}px)`, easing: BACK },
    { offset: 1, transform: 'translateY(0)' },
  ];
}

export function pullHintIndicatorKeyframes(): Keyframe[] {
  const rest = pullIndicatorFrame(0);
  const peak = pullIndicatorFrame(DEPTH_PX);
  const frame = (f: typeof rest) => ({
    opacity: f.opacity,
    transform: `translateY(${f.y}px) rotate(${f.deg}deg)`,
  });
  return [
    { offset: 0, ...frame(rest), easing: DOWN },
    { offset: at(DOWN_MS), ...frame(peak) },
    { offset: at(DOWN_MS + HOLD_MS), ...frame(peak), easing: BACK },
    { offset: 1, ...frame(rest) },
  ];
}
