import { describe, it, expect } from 'vitest';
import {
  shouldDismiss,
  dragOwnsGesture,
  snapDetent,
  consumesTravel,
  DISMISS_DISTANCE_PX,
  DETENT_DISTANCE_PX,
} from '../sheetDrag';

/**
 * The second argument is the RELEASE velocity in px/ms, downward positive — not
 * the gesture's duration, which is what it was until the sheet was reported as
 * "still isn't fluent, when I put my finger on it and then away, it starts
 * bugging". The reversal guard and the windowed measurement that produces this
 * number have their own file, sheetDragVelocity.test.ts.
 */
describe('shouldDismiss', () => {
  it('closes on a long drag regardless of speed', () => {
    // Barely moving at release — 96px over five seconds — and still a dismissal,
    // because the distance alone says the student meant it.
    expect(shouldDismiss(DISMISS_DISTANCE_PX, 0.02)).toBe(true);
  });

  it('closes on a short fast flick', () => {
    expect(shouldDismiss(40, 0.8)).toBe(true);
  });

  it('springs back on a short slow drag', () => {
    expect(shouldDismiss(40, 0.02)).toBe(false);
  });

  // The sheet is anchored to the bottom edge; dragging up has nowhere to go and
  // must never be read as a dismissal.
  it.each([-120, -1, 0])('ignores upward travel (%i)', (dy) => {
    expect(shouldDismiss(dy, 1)).toBe(false);
  });

  it('springs back when the finger was already still', () => {
    // Held, not thrown: a stationary release under the distance threshold is
    // the student deciding against it.
    expect(shouldDismiss(10, 0)).toBe(false);
  });
});

/**
 * The map sheet does not dismiss — it moves between two detents — so it needs a
 * rule that works in BOTH directions. `shouldDismiss` deliberately ignores
 * upward travel, which is why it could not be reused as-is.
 */
describe('snapDetent', () => {
  // One stop per gesture now: peek goes to `half`, not straight to expanded.
  // The three-stop ladder has its own describe block below.
  it('moves up a stop on a long upward drag from peek', () => {
    expect(snapDetent('peek', -DETENT_DISTANCE_PX, -0.013)).toBe('half');
  });

  it('moves up a stop on a short fast upward flick from peek', () => {
    expect(snapDetent('peek', -40, -0.8)).toBe('half');
  });

  it('moves down a stop on a long downward drag from expanded', () => {
    expect(snapDetent('expanded', DETENT_DISTANCE_PX, 0.013)).toBe('half');
  });

  it('moves down a stop on a short fast downward flick from expanded', () => {
    expect(snapDetent('expanded', 40, 0.8)).toBe('half');
  });

  it('stays put on a short slow drag in either direction', () => {
    expect(snapDetent('peek', -40, -0.02)).toBe('peek');
    expect(snapDetent('expanded', 40, 0.02)).toBe('expanded');
  });

  /**
   * The ladder gets the same reversal guard the dismissal has. Pulling the map
   * sheet up past the threshold and then pushing it back down before letting go
   * has to leave it where it started — the finger's last direction is the
   * decision, not the distance it happened to cover on the way.
   */
  it('stays put when the finger is travelling back at release', () => {
    expect(snapDetent('peek', -120, 0.4)).toBe('peek');
    expect(snapDetent('expanded', 120, -0.4)).toBe('expanded');
  });

  /**
   * Dragging further into the detent you are already at has nowhere to travel.
   * Pulling up while expanded must not "re-expand" and, more importantly,
   * pulling DOWN while at peek must not collapse it out of existence — peek is
   * the floor.
   */
  it('ignores travel that pushes past the detent already held', () => {
    expect(snapDetent('expanded', -200, -4)).toBe('expanded');
    expect(snapDetent('peek', 200, 4)).toBe('peek');
  });

  it('stays put on a short drag released at a standstill', () => {
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

/**
 * Three stops, not two.
 *
 * The campus events lived in a 166px peek that showed one summary line, so
 * seeing what was on meant dragging the sheet up over the map every time —
 * "the campus events need to be pulled up while looking at the map, they could
 * appear beside the map to be directly visible". A middle stop shows a couple
 * of events AND keeps the map in view, and the sheet opens at it.
 *
 * The ladder moves ONE stop per gesture, which is what makes a middle stop
 * reachable at all: a peek→expanded jump would skip straight over it.
 */
describe('snapDetent — the three-stop ladder', () => {
  it('goes up one stop from peek, to half rather than all the way', () => {
    expect(snapDetent('peek', -DETENT_DISTANCE_PX, -0.013)).toBe('half');
  });

  it('goes up one stop from half', () => {
    expect(snapDetent('half', -DETENT_DISTANCE_PX, -0.013)).toBe('expanded');
  });

  it('comes down one stop from expanded, to half', () => {
    expect(snapDetent('expanded', DETENT_DISTANCE_PX, 0.013)).toBe('half');
  });

  it('comes down one stop from half, to peek', () => {
    expect(snapDetent('half', DETENT_DISTANCE_PX, 0.013)).toBe('peek');
  });

  it('stays put at the ends, whichever way it is pushed', () => {
    // peek is the floor — the sheet is the only way to reach Akce — and
    // expanded is the ceiling.
    expect(snapDetent('peek', 200, 4)).toBe('peek');
    expect(snapDetent('expanded', -200, -4)).toBe('expanded');
  });

  it('takes a fast flick as a stop change from the middle too', () => {
    expect(snapDetent('half', -40, -0.8)).toBe('expanded');
    expect(snapDetent('half', 40, 0.8)).toBe('peek');
  });

  it('ignores a slow, short drag from the middle', () => {
    expect(snapDetent('half', -40, -0.02)).toBe('half');
    expect(snapDetent('half', 40, 0.02)).toBe('half');
  });
});

describe('consumesTravel — the middle stop absorbs both ways', () => {
  it('absorbs up and down from half', () => {
    expect(consumesTravel('half', -20)).toBe(true);
    expect(consumesTravel('half', 20)).toBe(true);
  });

  it('still refuses the direction each end cannot travel', () => {
    expect(consumesTravel('peek', 20)).toBe(false);
    expect(consumesTravel('expanded', -20)).toBe(false);
  });

  it('absorbs nothing at zero', () => {
    expect(consumesTravel('half', 0)).toBe(false);
  });
});
