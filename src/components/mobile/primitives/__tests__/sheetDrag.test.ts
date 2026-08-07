import { describe, it, expect } from 'vitest';
import { shouldDismiss, dragOwnsGesture, DISMISS_DISTANCE_PX } from '../sheetDrag';

describe('shouldDismiss', () => {
  it('closes on a long drag regardless of speed', () => {
    expect(shouldDismiss(DISMISS_DISTANCE_PX, 5000)).toBe(true);
  });

  it('closes on a short fast flick', () => {
    expect(shouldDismiss(40, 50)).toBe(true);
  });

  it('springs back on a short slow drag', () => {
    expect(shouldDismiss(40, 2000)).toBe(false);
  });

  // The sheet is anchored to the bottom edge; dragging up has nowhere to go and
  // must never be read as a dismissal.
  it.each([-120, -1, 0])('ignores upward travel (%i)', (dy) => {
    expect(shouldDismiss(dy, 100)).toBe(false);
  });

  it('does not divide by a zero timestamp delta', () => {
    expect(shouldDismiss(10, 0)).toBe(false);
  });
});

describe('dragOwnsGesture', () => {
  const build = (opts: { overflowY: string; scrollTop: number; scrollable: boolean }) => {
    const panel = document.createElement('div');
    const scroller = document.createElement('div');
    const child = document.createElement('span');
    scroller.style.overflowY = opts.overflowY;
    Object.defineProperty(scroller, 'scrollTop', { value: opts.scrollTop, writable: true });
    Object.defineProperty(scroller, 'scrollHeight', { value: opts.scrollable ? 2000 : 100 });
    Object.defineProperty(scroller, 'clientHeight', { value: 100 });
    scroller.appendChild(child);
    panel.appendChild(scroller);
    document.body.appendChild(panel);
    return { panel, child };
  };

  /**
   * The case that matters most: a student reading halfway down a long file list
   * swipes down to scroll back up. That must scroll, not close the sheet.
   */
  it('yields to a scroller that is not at the top', () => {
    const { panel, child } = build({ overflowY: 'auto', scrollTop: 488, scrollable: true });
    expect(dragOwnsGesture(child, panel)).toBe(false);
  });

  it('takes the gesture once the scroller is back at the top', () => {
    const { panel, child } = build({ overflowY: 'auto', scrollTop: 0, scrollable: true });
    expect(dragOwnsGesture(child, panel)).toBe(true);
  });

  // Overflowing content inside a non-scrolling parent is not a scroller. Reading
  // it as one would silently disable dismissal on ordinary sheets.
  it('ignores a tall element that cannot actually scroll', () => {
    const { panel, child } = build({ overflowY: 'visible', scrollTop: 0, scrollable: true });
    expect(dragOwnsGesture(child, panel)).toBe(true);
  });

  it('takes the gesture when there is no scroller at all', () => {
    const panel = document.createElement('div');
    const child = document.createElement('span');
    panel.appendChild(child);
    expect(dragOwnsGesture(child, panel)).toBe(true);
  });
});
