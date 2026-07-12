import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiniCalendar } from '../MiniCalendar';

const t = (k: string) => k;

describe('MiniCalendar', () => {
  it('shows the placeholder when empty and opens a grid', () => {
    render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="cs-CZ"
      />
    );
    fireEvent.click(screen.getByText('Pick a date'));
    // a day button from some month is present
    expect(screen.getAllByRole('button').length).toBeGreaterThan(10);
  });

  it('emits YYYY-MM-DD when a day is clicked', () => {
    const onChange = vi.fn();
    render(
      <MiniCalendar
        value="2026-07-01"
        onChange={onChange}
        placeholder="Pick a date"
        t={t}
        locale="cs-CZ"
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /2026-07-01|1\. .*2026|Datum|Pick/i }).closest('button')!
    );
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    expect(onChange).toHaveBeenCalledWith('2026-07-15');
  });

  it('portals the popover to <body> so the panel overflow can not clip it', () => {
    // The composer lives in a side panel with overflow-hidden; an in-flow
    // absolute popover gets clipped. The calendar renders via a body portal
    // instead, so its grid is a descendant of <body>, not of the component root.
    const { container } = render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="en-US"
      />
    );
    fireEvent.click(screen.getByText('Pick a date'));
    const day = screen.getByRole('button', { name: '15' });
    expect(container.contains(day)).toBe(false); // portalled out of the component
    expect(document.body.contains(day)).toBe(true);
  });

  it('trigger has no tabindex (a [tabindex] dropdown trigger gets pointer-events:none on focus, so a real click never opens it)', () => {
    // Regression guard for the original bug: as a DaisyUI `.dropdown` trigger,
    // marking the <button> [tabindex] made
    // `.dropdown:focus-within > [tabindex]:first-child { pointer-events:none }`
    // fire the moment mousedown focused it, so the click landed on the parent and
    // onClick never ran. happy-dom can't apply that CSS, so guard the cause: the
    // <button> stays focusable natively and must NOT be marked [tabindex].
    render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="en-US"
      />
    );
    const trigger = screen.getByText('Pick a date').closest('button')!;
    expect(trigger.hasAttribute('tabindex')).toBe(false);
  });

  it('localizes the weekday header from the locale (English), not hardcoded Czech', () => {
    render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="en-US"
      />
    );
    fireEvent.click(screen.getByText('Pick a date'));
    // Monday-first, English short names — never the old hardcoded 'Po'/'Út'.
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.queryByText('Po')).toBeNull();
  });

  it('flips the popover above the trigger when it would overflow the viewport bottom', () => {
    // happy-dom reports offsetHeight 0, so updatePos falls back to the 340px
    // estimate — deterministic geometry we can assert on. innerHeight 500 with a
    // trigger whose bottom is 490 leaves no room below (490+6+340 > 492), but
    // 114px above (460-6-340), so the card must flip above the trigger.
    const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
    render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="en-US"
      />
    );
    const trigger = screen.getByText('Pick a date').closest('button')!;
    trigger.getBoundingClientRect = () =>
      ({ top: 460, bottom: 490, left: 12, right: 300, width: 288, height: 30 }) as DOMRect;
    fireEvent.click(trigger);
    const pop = Array.from(document.querySelectorAll('div')).find(
      (d) => d.style.width === '288px'
    )!;
    expect(pop.style.top).toBe('114px');
    if (innerHeight) Object.defineProperty(window, 'innerHeight', innerHeight);
  });

  it('closes the popover when clicking outside', () => {
    render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="cs-CZ"
      />
    );
    fireEvent.click(screen.getByText('Pick a date'));
    expect(screen.getAllByRole('button').length).toBeGreaterThan(10);
    fireEvent.mouseDown(document.body);
    expect(screen.getAllByRole('button').length).toBe(1);
  });
});
