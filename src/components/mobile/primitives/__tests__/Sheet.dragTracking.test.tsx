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

  it('leaves an upward drag alone, so the content underneath can scroll', () => {
    const panel = drag();
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 100, pointerId: 1 });
    // A bottom sheet has nowhere to travel upward, and the `absorbs` predicate
    // that says so is load-bearing twice: it keeps the panel still, and inside
    // the hook it gates the `preventDefault` that claims the touch. Absorbing
    // upward travel here would take every upward swipe away from the file list
    // in DocsSheet and the results in SearchSheet — `dragOwnsGesture` does not
    // catch that, because it yields only once a scroller is past its top.
    expect(panel.style.transform).toBe('');
  });

  it('does not replay the entry animation when a drag is released', () => {
    const panel = drag();
    expect(panel.className).toContain('animate-[sheetUp');
    fireEvent.pointerDown(panel, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 230, pointerId: 1 });
    expect(panel.className).not.toContain('animate-[sheetUp');
    fireEvent.pointerUp(panel, { clientY: 230, pointerId: 1 });
    // The flag is a latch. Cleared on release it re-added the class to an
    // element already on screen, restarting the 0.3s slide up from the bottom
    // edge — a small pull, a release, and the sheet visibly re-enters. That is
    // "put my finger on it and then away, it starts bugging".
    expect(panel.className).not.toContain('animate-[sheetUp');
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
    // One, for the latch that drops the entry animation — not twenty.
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
