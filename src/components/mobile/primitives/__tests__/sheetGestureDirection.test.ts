import { describe, it, expect } from 'vitest';
import { goesSideways, insideSidewaysScroller } from '../sheetGestureDirection';

/**
 * A touch on the S-klub menu's chip row: sideways scrolls the row, up or down
 * still moves the sheet. Deciding by place alone dragged the whole sheet on a
 * slightly diagonal swipe ("sometimes it swipes with the entire section",
 * Dominik, 2026-11-09), and yielding by place alone froze the sheet for a
 * vertical drag started on a chip (cubic and CodeRabbit on #662).
 */
describe('insideSidewaysScroller', () => {
  const row = (scrollWidth: number) => {
    const panel = document.createElement('div');
    const r = document.createElement('div');
    const chip = document.createElement('button');
    r.style.overflowX = 'auto';
    Object.defineProperty(r, 'scrollWidth', { value: scrollWidth });
    Object.defineProperty(r, 'clientWidth', { value: 300 });
    r.appendChild(chip);
    panel.appendChild(r);
    document.body.appendChild(panel);
    return { panel, chip };
  };

  it('finds a row that really scrolls sideways', () => {
    const { panel, chip } = row(600);
    expect(insideSidewaysScroller(chip, panel)).toBe(true);
  });

  // overflow-y: auto computes overflow-x: auto too, so a vertical list with a
  // few stray pixels of width must not count.
  it('ignores a few pixels of incidental overflow', () => {
    const { panel, chip } = row(304);
    expect(insideSidewaysScroller(chip, panel)).toBe(false);
  });
});

describe('goesSideways', () => {
  it("reads a mostly sideways first move as the row's", () => {
    expect(goesSideways(12, 4)).toBe(true);
    expect(goesSideways(-9, 9)).toBe(true);
  });

  it("reads a mostly vertical first move as the sheet's", () => {
    expect(goesSideways(3, 14)).toBe(false);
  });

  it('decides nothing before the finger moves', () => {
    expect(goesSideways(0, 0)).toBeNull();
  });
});
