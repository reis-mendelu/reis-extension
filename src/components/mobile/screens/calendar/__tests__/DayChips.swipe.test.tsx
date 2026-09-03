import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayChips } from '../DayChips';

/**
 * The strip has to be swipeable, and the arrows have to be touchable.
 *
 * Reported as "switching to the next week in the calendar has a small '>'
 * button. It feels a bit unintuitive." Two things were true of it: the chevron
 * was 28x36px, under the 44pt touch minimum, and it was the ONLY route to
 * another week — the gesture a horizontal row of days invites did nothing at
 * all.
 *
 * Velocity itself is asserted in weekSwipe.test.ts rather than here: happy-dom
 * stamps its own `timeStamp` on synthesised events and ignores the one
 * `fireEvent` is given, so no DOM test in this project can dictate a gesture's
 * speed. What these cover is the wiring and the arbitration.
 */
describe('DayChips — swiping to change week', () => {
  // A Thursday, so a week either way stays inside the same month.
  const THU = '2026-09-10';

  const setup = () => {
    const onSelect = vi.fn();
    render(<DayChips selectedIso={THU} onSelect={onSelect} lessonDates={new Set()} />);
    return { onSelect, strip: screen.getByTestId('day-strip') };
  };

  const swipe = (strip: HTMLElement, dx: number, dy = 0) => {
    fireEvent.pointerDown(strip, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 200 + dx / 2, clientY: 100 + dy / 2, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 200 + dx, clientY: 100 + dy, pointerId: 1 });
    fireEvent.pointerUp(strip, { clientX: 200 + dx, clientY: 100 + dy, pointerId: 1 });
  };

  it('pulls next week in when the strip is dragged left', () => {
    const { onSelect, strip } = setup();
    swipe(strip, -120);
    expect(onSelect).toHaveBeenCalledWith('2026-09-17');
  });

  it('brings last week back when it is dragged right', () => {
    const { onSelect, strip } = setup();
    swipe(strip, 120);
    expect(onSelect).toHaveBeenCalledWith('2026-09-03');
  });

  it('leaves a vertical drag to the agenda underneath', () => {
    // The strip sits directly above a scrolling list. A finger that starts on a
    // chip and moves down is someone reading the day, not changing week.
    const { onSelect, strip } = setup();
    swipe(strip, 0, 160);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves a lazy diagonal alone rather than jumping a week past it', () => {
    const { onSelect, strip } = setup();
    swipe(strip, -60, 50);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('follows the finger while the swipe is in flight, and lets go after', () => {
    const { strip } = setup();
    fireEvent.pointerDown(strip, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 80, clientY: 100, pointerId: 1 });
    // Damped, not 1:1 — there is no next week rendered beside this one to drag
    // into view, so tracking exactly would promise a filmstrip that isn't there.
    expect(strip.style.transform).toBe('translateX(-40px)');
    // And no easing curve in the way of the finger, the lesson the sheet drag
    // was rebuilt around.
    expect(strip.style.transition).toBe('none');
    fireEvent.pointerUp(strip, { clientX: 80, clientY: 100, pointerId: 1 });
    expect(strip.style.transform).toBe('');
    expect(strip.style.transition).toBe('');
  });

  it('does not select the day the finger happened to land on', () => {
    // A swipe ends in a click on whatever chip is under it, which would select
    // a day in the week just swiped away from.
    const { onSelect, strip } = setup();
    swipe(strip, -120);
    onSelect.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Čt 10/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still lets a plain tap select a day', () => {
    const { onSelect, strip } = setup();
    // Inside the slop: a tap jitters by a pixel or two and must not read as a
    // swipe, or the chips become unselectable.
    fireEvent.pointerDown(strip, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 202, clientY: 101, pointerId: 1 });
    fireEvent.pointerUp(strip, { clientX: 202, clientY: 101, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Pá 11/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-09-11');
  });

  it('puts the strip back when the browser takes the gesture', () => {
    const { onSelect, strip } = setup();
    fireEvent.pointerDown(strip, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 60, clientY: 100, pointerId: 1 });
    fireEvent.pointerCancel(strip, { clientX: 60, clientY: 100, pointerId: 1 });
    expect(strip.style.transform).toBe('');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('claims the touch gesture so the browser cannot pan it away mid-swipe', () => {
    const spy = vi.spyOn(Element.prototype, 'addEventListener');
    render(<DayChips selectedIso={THU} onSelect={() => {}} lessonDates={new Set()} />);
    const nonPassive = spy.mock.calls.some(
      ([type, , opts]) =>
        type === 'touchmove' &&
        typeof opts === 'object' &&
        opts !== null &&
        (opts as AddEventListenerOptions).passive === false
    );
    expect(nonPassive).toBe(true);
    spy.mockRestore();
  });
});

describe('DayChips — the week arrows', () => {
  const THU = '2026-09-10';

  it('flank the strip, one at each end, where they always were', () => {
    render(<DayChips selectedIso={THU} onSelect={() => {}} lessonDates={new Set()} />);
    const prev = screen.getByRole('button', { name: 'Předchozí týden' });
    const next = screen.getByRole('button', { name: 'Další týden' });
    const strip = screen.getByTestId('day-strip');
    // Collecting them into one pill on the right — the desktop header's
    // arrangement — was built and rejected: "no this is terrible, revert the
    // '<' and '>' just as they were before just a little larger". On a phone
    // the arrow on the side you are heading towards is the arrow you reach for.
    const row = strip.parentElement;
    expect(prev.parentElement).toBe(row);
    expect(next.parentElement).toBe(row);
    const order = [...(row?.children ?? [])];
    expect(order.indexOf(prev)).toBeLessThan(order.indexOf(strip));
    expect(order.indexOf(next)).toBeGreaterThan(order.indexOf(strip));
  });

  it('are at least 44px tall, the touch minimum the old ones missed', () => {
    render(<DayChips selectedIso={THU} onSelect={() => {}} lessonDates={new Set()} />);
    for (const name of ['Předchozí týden', 'Další týden']) {
      // h-11 is 2.75rem = 44px. Asserted through the class because happy-dom
      // lays nothing out and every measured height here would be 0.
      expect(screen.getByRole('button', { name }).className).toContain('h-11');
    }
  });

  it('still move exactly one week each', () => {
    const onSelect = vi.fn();
    render(<DayChips selectedIso={THU} onSelect={onSelect} lessonDates={new Set()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Další týden' }));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-17');
    fireEvent.click(screen.getByRole('button', { name: 'Předchozí týden' }));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-03');
  });
});
