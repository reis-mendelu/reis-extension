/**
 * Which way a sheet gesture is going, for a touch that starts in a row that
 * scrolls sideways (the S-klub menu's category chips). `useSheetDrag` asks
 * these on the first move: sideways leaves the gesture to the row, up or down
 * keeps it for the sheet. Split from `sheetDrag.ts` to keep that file within
 * the 200-line convention (CodeRabbit on #662).
 */

/**
 * How much a row must overflow sideways before it counts as one that scrolls.
 * An element with `overflow-y: auto` also computes `overflow-x: auto`, so the
 * sheet's own list reads as "sideways-scrollable" whenever something pokes a
 * few pixels past its edge (a chip row's negative margin does). cubic on #662.
 */
const SIDEWAYS_MIN_OVERFLOW_PX = 8;

/**
 * Whether `target` sits in a row that scrolls sideways (the S-klub menu's
 * category chips), up to the sheet panel. A touch that starts there is decided
 * by its direction (`useSheetDrag`): sideways scrolls the row, up or down still
 * moves the sheet.
 */
export function insideSidewaysScroller(target: Element | null, stopAt: Element | null): boolean {
  let node: Element | null = target;
  while (node && node !== stopAt?.parentElement) {
    const overflowX = getComputedStyle(node).overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth - node.clientWidth >= SIDEWAYS_MIN_OVERFLOW_PX
    )
      return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * A first move that says the finger is going sideways: the row should scroll,
 * not the sheet. Null while it has not moved at all, so nothing is decided on
 * a zero-length first event.
 */
export function goesSideways(dx: number, dy: number): boolean | null {
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy);
}
