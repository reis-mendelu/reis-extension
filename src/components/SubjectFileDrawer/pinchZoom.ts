/** Zoom bounds shared by the toolbar buttons and the pinch gesture. */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** The scale a pinch has reached: the start scale times how far the fingers spread. */
export function pinchScale(startScale: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return startScale;
  return clampScale((startScale * distance) / startDistance);
}

export interface Point {
  x: number;
  y: number;
}

type Scroll = { left: number; top: number };

/**
 * The scroll offset that keeps the content under `focal` (a point in the
 * pane's own coordinates) under it after the content grows by `ratio`.
 *
 * The live preview scaled around the content point under the fingers at
 * `start`; if the pane panned to `current` during the pinch, that travel is
 * kept rather than snapped back. With no pan the two terms cancel.
 */
export function anchoredScroll(
  start: Scroll,
  current: Scroll,
  focal: Point,
  ratio: number
): Scroll {
  const axis = (s: number, c: number, f: number) => Math.max(0, (s + f) * ratio - (s + f - c));
  return {
    left: axis(start.left, current.left, focal.x),
    top: axis(start.top, current.top, focal.y),
  };
}
