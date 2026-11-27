import { describe, it, expect } from 'vitest';
import { hasMoreBelow, MORE_BELOW_SLACK_PX } from '../moreBelow';

/**
 * Whether a vertical scroller still hides content below — the rule behind
 * Profil's bottom fade. Profil's scroller is always 1px taller than its box
 * (AlwaysScrollable) and ends in padding that clears the floating nav, so the
 * fade must not light on overflow that is only that.
 */
describe('hasMoreBelow', () => {
  const at = (scrollTop: number, scrollHeight: number, clientHeight = 500) =>
    hasMoreBelow({ scrollTop, scrollHeight, clientHeight });

  it('is off when the content fits and only AlwaysScrollable’s 1px overflows', () => {
    expect(at(0, 501)).toBe(false);
  });

  it('is off while the hidden part is no more than the padding over the nav clearance', () => {
    expect(at(0, 500 + MORE_BELOW_SLACK_PX)).toBe(false);
  });

  it('is on at the top when a row really sits below the fold', () => {
    expect(at(0, 500 + MORE_BELOW_SLACK_PX + 1)).toBe(true);
    expect(at(0, 646)).toBe(true);
  });

  it('is on part way down and off at the end', () => {
    expect(at(60, 646)).toBe(true);
    expect(at(146, 646)).toBe(false);
  });

  it('is off when the scroller is scrolled to within the slack of the end', () => {
    // Fractional scrollTop on a 2x/3x screen lands a hair short of max.
    expect(at(145.5, 646)).toBe(false);
    expect(at(146 - MORE_BELOW_SLACK_PX, 646)).toBe(false);
  });

  it('is off while iOS rubber-bands past the end', () => {
    expect(at(180, 646)).toBe(false);
  });

  it('is on while iOS rubber-bands above the top with content below', () => {
    expect(at(-40, 646)).toBe(true);
  });

  it('is off for a scroller with no size yet', () => {
    expect(at(0, 0, 0)).toBe(false);
  });
});
