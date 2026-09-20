import { describe, it, expect } from 'vitest';
import {
  parseSafeInset,
  navClearancePx,
  peekHeightPx,
  NAV_GAP_PX,
  NAV_HEIGHT_PX,
  PEEK_BASE_PX,
} from '../safeArea';

describe('parseSafeInset', () => {
  it('reads a px length', () => {
    expect(parseSafeInset('48px')).toBe(48);
    expect(parseSafeInset('33.5px')).toBe(33.5);
  });

  /**
   * All three are "this device has no bottom inset", and all three reach
   * arithmetic. A NaN here would propagate into a `calc`-free `Math.max` and
   * collapse the map sheet to zero height rather than to its peek.
   */
  it('treats an unset, zero or unresolved value as no inset', () => {
    expect(parseSafeInset('')).toBe(0);
    expect(parseSafeInset('0px')).toBe(0);
    expect(parseSafeInset('env(safe-area-inset-bottom)')).toBe(0);
  });
});

describe('navClearancePx', () => {
  it('is the pill top edge: the gap plus its height', () => {
    expect(navClearancePx(0)).toBe(NAV_GAP_PX + NAV_HEIGHT_PX);
  });

  /**
   * The bug in one assertion. On a 3-button Android bar the pill has to move
   * up by the whole 48dp, and everything that clears it has to move with it —
   * otherwise the fix just trades the system bar overlapping the nav for the
   * nav overlapping the content.
   */
  it('grows by the whole inset, so the pill clears the system bar', () => {
    expect(navClearancePx(48)).toBe(48 + NAV_GAP_PX + NAV_HEIGHT_PX);
    expect(navClearancePx(48) - navClearancePx(0)).toBe(48);
  });
});

describe('peekHeightPx', () => {
  it('is the phone peek band when there is no inset', () => {
    expect(peekHeightPx(0)).toBe(PEEK_BASE_PX);
  });

  /**
   * The drag floor and the resting height are the same number by
   * construction. They used to be two: a `166` constant in MapSheet feeding
   * `useMapSheetDrag`'s clamp, and an `h-[166px]` class beside it, kept in
   * sync by a comment. Moving only the class would let a drag undershoot the
   * resting height by the inset and snap back.
   */
  it('reserves the nav footprint, inset included', () => {
    expect(peekHeightPx(48)).toBe(PEEK_BASE_PX + 48);
    expect(peekHeightPx(48)).toBeGreaterThan(navClearancePx(48));
  });
});
