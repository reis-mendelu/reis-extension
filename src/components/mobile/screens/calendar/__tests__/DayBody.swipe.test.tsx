import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayBody } from '../DayBody';
import { useAppStore } from '../../../../../store/useAppStore';

vi.mock('../RecentFilesStrip', () => ({ RecentFilesStrip: () => <div /> }));
vi.mock('../MenuCard', () => ({ MenuCard: () => <div /> }));

/**
 * "Možnost pohybovat se pomocí swipu na obrazovce."
 *
 * The strip above moves a WEEK per swipe, and until now that was the only
 * gesture on the screen — the day itself could only be changed by aiming at a
 * 1/5-width chip. Swiping the agenda moves a DAY, which is the step that was
 * missing.
 *
 * The body is a vertical scroller, so the arbitration in `useSwipeSteps` is
 * load-bearing here rather than a nicety: a downward drag has to stay a scroll.
 */
describe('DayBody — swiping to change day', () => {
  const THU = '2026-09-10';

  beforeEach(() => {
    useAppStore.setState({ mobileSelectedDayIso: null });
  });

  const setup = () => {
    const onSelectDay = vi.fn();
    render(
      <DayBody
        agenda={[]}
        selectedIso={THU}
        holiday={null}
        outsideTeaching={false}
        teachingStartsOn={null}
        onSelectDay={onSelectDay}
      />
    );
    return { onSelectDay, body: screen.getByTestId('day-body') };
  };

  const swipe = (el: HTMLElement, dx: number, dy = 0) => {
    fireEvent.pointerDown(el, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 200 + dx / 2, clientY: 300 + dy / 2, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1 });
  };

  it('moves to tomorrow when the day is dragged left', () => {
    const { onSelectDay, body } = setup();
    swipe(body, -120);
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-11');
  });

  it('moves to yesterday when it is dragged right', () => {
    const { onSelectDay, body } = setup();
    swipe(body, 120);
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-09');
  });

  it('one day per swipe, however far the finger travels', () => {
    const { onSelectDay, body } = setup();
    swipe(body, -600);
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-11');
  });

  it('leaves a vertical drag to the scroller', () => {
    const { onSelectDay, body } = setup();
    swipe(body, 0, 200);
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it('leaves a lazy diagonal scroll alone', () => {
    const { onSelectDay, body } = setup();
    swipe(body, -60, 50);
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it('crosses the weekend into the next week', () => {
    const onSelectDay = vi.fn();
    render(
      <DayBody
        agenda={[]}
        selectedIso="2026-09-11"
        holiday={null}
        outsideTeaching={false}
        teachingStartsOn={null}
        onSelectDay={onSelectDay}
      />
    );
    const bodies = screen.getAllByTestId('day-body');
    swipe(bodies[bodies.length - 1]!, -120);
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-12');
  });
});
