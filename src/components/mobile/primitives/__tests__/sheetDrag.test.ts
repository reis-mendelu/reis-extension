import { describe, it, expect } from 'vitest';
import {
  shouldDismiss,
  dragOwnsGesture,
  snapDetent,
  consumesTravel,
  DISMISS_DISTANCE_PX,
  DETENT_DISTANCE_PX,
} from '../sheetDrag';

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

/**
 * The map sheet does not dismiss — it moves between two detents — so it needs a
 * rule that works in BOTH directions. `shouldDismiss` deliberately ignores
 * upward travel, which is why it could not be reused as-is.
 */
describe('snapDetent', () => {
  it('expands on a long upward drag from peek', () => {
    expect(snapDetent('peek', -DETENT_DISTANCE_PX, 5000)).toBe('expanded');
  });

  it('expands on a short fast upward flick from peek', () => {
    expect(snapDetent('peek', -40, 50)).toBe('expanded');
  });

  it('collapses on a long downward drag from expanded', () => {
    expect(snapDetent('expanded', DETENT_DISTANCE_PX, 5000)).toBe('peek');
  });

  it('collapses on a short fast downward flick from expanded', () => {
    expect(snapDetent('expanded', 40, 50)).toBe('peek');
  });

  it('stays put on a short slow drag in either direction', () => {
    expect(snapDetent('peek', -40, 2000)).toBe('peek');
    expect(snapDetent('expanded', 40, 2000)).toBe('expanded');
  });

  /**
   * Dragging further into the detent you are already at has nowhere to travel.
   * Pulling up while expanded must not "re-expand" and, more importantly,
   * pulling DOWN while at peek must not collapse it out of existence — peek is
   * the floor.
   */
  it('ignores travel that pushes past the detent already held', () => {
    expect(snapDetent('expanded', -200, 50)).toBe('expanded');
    expect(snapDetent('peek', 200, 50)).toBe('peek');
  });

  it('does not divide by a zero timestamp delta', () => {
    expect(snapDetent('peek', -10, 0)).toBe('peek');
  });
});

describe('consumesTravel', () => {
  it('absorbs downward travel only when expanded', () => {
    expect(consumesTravel('expanded', 20)).toBe(true);
    expect(consumesTravel('expanded', -20)).toBe(false);
  });

  it('absorbs upward travel only when at peek', () => {
    expect(consumesTravel('peek', -20)).toBe(true);
    expect(consumesTravel('peek', 20)).toBe(false);
  });

  it('absorbs nothing at rest', () => {
    expect(consumesTravel('peek', 0)).toBe(false);
    expect(consumesTravel('expanded', 0)).toBe(false);
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
