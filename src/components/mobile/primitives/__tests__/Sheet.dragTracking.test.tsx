import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Profiler } from 'react';
import { Sheet } from '../Sheet';

/**
 * The sheet has to move WITH the finger, not one render behind it.
 *
 * Reported as "Novinky slidedown still isn't fluent, when I put my finger on it
 * and then away, it starts bugging" — after the pointercancel and pointer
 * capture fixes had already landed, so the steal was no longer the whole story.
 *
 * Two mechanisms remained, both of them about the offset being React state:
 *
 *  - **The transition fought the finger.** A 200ms `transition: transform` sat
 *    on the panel so the snap-back would animate, and it was taken off by a
 *    re-render once dragging began. A re-render lands a frame late, so the
 *    first offsets the finger sets are EASED — the sheet starts every drag
 *    lagging, drifts on after the finger stops, and a quick down-and-off is
 *    still animating when the gesture is already over. That is the "put my
 *    finger on it and then away" case exactly.
 *  - **A render per move.** Sixty React renders a second, of the whole sheet
 *    subtree, for a transform the compositor could take on its own. On an iPad
 *    8 that is where the stutter comes from.
 *
 * Velocity is asserted in sheetDragVelocity.test.ts rather than here: happy-dom
 * stamps its own `timeStamp` on synthesised events and ignores the one passed
 * to `fireEvent`, so no DOM test in this project can dictate a gesture's speed.
 */
describe('Sheet drag tracking', () => {
  const drag = () => {
    render(
      <Sheet size="content" onClose={() => {}}>
        body
      </Sheet>
    );
    return screen.getByTestId('sheet-panel');
  };

  it('follows the finger one-to-one downward, with no easing in the way', () => {
    const panel = drag();
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 260, pointerId: 1 });
    expect(panel.style.transform).toBe('translateY(60px)');
    // The load-bearing half: an easing curve here animates the offset the
    // finger just set, which is the lag being reported.
    expect(panel.style.transition).toBe('none');
  });

  it('hands the animation back on release, so the spring back is smooth', () => {
    const panel = drag();
    // Released UPWARD on purpose. A downward release cannot be held to a
    // decision here: `fireEvent` calls land inside a single millisecond, so the
    // whole gesture sits inside the velocity window and reads as a flick
    // whatever timestamps are passed. Upward travel never dismisses by rule, so
    // this exercises the snap-back path without depending on the clock.
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 160, pointerId: 1 });
    fireEvent.pointerUp(panel, { clientY: 160, pointerId: 1 });
    // Cleared, not set: the resting transition is a class, and an inline value
    // left behind would win over it forever.
    expect(panel.style.transition).toBe('');
    expect(panel.style.transform).toBe('');
    expect(panel.className).toContain('transition-transform');
  });

  it('resists an upward drag instead of ignoring it', () => {
    const panel = drag();
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 100, pointerId: 1 });
    const y = Number(/translateY\((-?[\d.]+)px\)/.exec(panel.style.transform)?.[1]);
    // A bottom sheet dragged up has nowhere to go. Pinning it at 0 reads as
    // "stuck"; following the finger 1:1 promises travel that does not exist.
    expect(y).toBeLessThan(0);
    expect(y).toBeGreaterThan(-100);
  });

  it('does not re-render the sheet on every move', () => {
    // A Profiler rather than a counter in `children`: the children element is
    // the same object across renders, so React bails out of the subtree and a
    // counter down there cannot tell sixty parent renders from one. The
    // Profiler commits once per render of the tree it wraps.
    const commit = vi.fn();
    render(
      <Profiler id="sheet" onRender={commit}>
        <Sheet size="content" onClose={() => {}}>
          body
        </Sheet>
      </Profiler>
    );
    const panel = screen.getByTestId('sheet-panel');
    commit.mockClear();
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    for (let i = 1; i <= 20; i++)
      fireEvent.pointerMove(panel, { clientY: 200 + i * 5, pointerId: 1 });
    // One, for the flag that drops the entry animation — not twenty.
    expect(commit.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('clears the offset when the browser takes the gesture', () => {
    const panel = drag();
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 300, pointerId: 1 });
    fireEvent.pointerCancel(panel, { clientY: 300, pointerId: 1 });
    expect(panel.style.transform).toBe('');
    expect(panel.style.transition).toBe('');
  });
});
