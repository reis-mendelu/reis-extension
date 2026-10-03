/**
 * Where a sideways swipe across a whole surface may NOT start, because
 * something else already owns a sideways gesture there.
 *
 * - **The screen edges.** Android's gesture navigation takes a swipe in from
 *   either edge as back, and iOS users reach for the left edge by habit. A
 *   swipe that started there and changed tab instead would fight the system.
 * - **A horizontal scroller that overflows** — the grading table in Sylabus,
 *   the arch rows in Záznamník, the semester chips in Úspěšnost. Its own pan is
 *   the only way to reach the clipped columns. One that FITS is not a scroller
 *   in any sense the finger can feel, so it does not block.
 * - **A text field**, where a sideways drag moves the caret.
 *
 * Read once, at pointerdown, from the pressed element up to the swipe root and
 * no further: what scrolls above the root is outside the surface.
 */
export const EDGE_GUARD_PX = 20;

/**
 * How far content must overflow before a scroller counts as horizontal.
 *
 * `overflow-y: auto` computes `overflow-x: auto` too — CSS will not let one
 * axis stay `visible` beside a scrolling one — so every vertical list in a tab
 * reads as a horizontal scroller to `getComputedStyle`. A negative margin that
 * pushes one 1px wider would otherwise switch the swipe off across the whole
 * tab. A real horizontal scroller overflows by a column, not a pixel.
 */
export const SCROLLER_MIN_OVERFLOW_PX = 8;

const TEXT_FIELD = 'input, textarea, select, [contenteditable="true"]';

function scrollsSideways(el: Element): boolean {
  const { overflowX } = getComputedStyle(el);
  return (
    (overflowX === 'auto' || overflowX === 'scroll') &&
    el.scrollWidth - el.clientWidth >= SCROLLER_MIN_OVERFLOW_PX
  );
}

export function swipeStartIsOffLimits(
  target: Element | null,
  root: Element | null,
  clientX: number,
  viewportWidth: number
): boolean {
  if (clientX < EDGE_GUARD_PX || clientX > viewportWidth - EDGE_GUARD_PX) return true;
  if (target?.closest(TEXT_FIELD)) return true;
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (scrollsSideways(el)) return true;
  }
  return false;
}
