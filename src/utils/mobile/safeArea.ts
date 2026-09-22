/**
 * The bottom safe-area inset, and the geometry derived from it.
 *
 * `targetSdk 36` means Android 15+ draws the app edge-to-edge with no opt-out:
 * the window now extends UNDER the system navigation bar. Everything anchored
 * to the bottom of the window is therefore anchored below that bar — the
 * floating `BottomNav` sits 18px up, is 58px tall, and a 3-button bar is 48dp,
 * so 30 of those 58px are covered. Reported as "prekrývajú sa mi spodné
 * tlačidlá", with a screenshot of a half-buried nav pill.
 *
 * `capacitor/index.html` sets `viewport-fit=cover`, so the WebView fills
 * `env(safe-area-inset-bottom)` and `src/index.css` republishes it as
 * `--safe-bottom`. The top half of this was already done — `--safe-top` is
 * consumed in eight places — and the bottom was not: the only component that
 * ever read `--safe-bottom` was `MobileBottomNav`, which nothing renders.
 *
 * Read as a NUMBER rather than left to CSS because one consumer is JavaScript:
 * `useMapSheetDrag` clamps the sheet's drag floor to the peek height, and a
 * `calc()` in a class cannot reach a `Math.max`. If the two disagree the sheet
 * undershoots its own resting height by the inset and snaps back.
 */

/** The floating BottomNav's height, and its gap above the safe area. */
export const NAV_HEIGHT_PX = 58;
export const NAV_GAP_PX = 18;

/** The map sheet's collapsed height on a phone with no inset. */
export const PEEK_BASE_PX = 166;

/**
 * A CSS length in px as a number. `''` when the property is unset, and an
 * unresolved `env(...)` when the browser does not support it — both are "no
 * inset", not NaN, because every caller here is doing arithmetic with it.
 */
export function parseSafeInset(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * How much room the floating nav needs above the bottom of the window — the
 * pill's top edge. Content that would otherwise run under the nav is padded
 * by this, and the map sheet's peek band reserves it.
 */
export function navClearancePx(safeBottom: number): number {
  return safeBottom + NAV_GAP_PX + NAV_HEIGHT_PX;
}

/**
 * The map sheet's collapsed height. It reserves the nav's whole footprint —
 * the nav is drawn against the SCREEN, not the sheet — so it grows by exactly
 * the inset.
 */
export function peekHeightPx(safeBottom: number): number {
  return PEEK_BASE_PX + safeBottom;
}
