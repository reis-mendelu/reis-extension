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

  it('marks the container dropdown-open while open (DaisyUI hides the popover otherwise)', () => {
    // DaisyUI 5 display:none's .dropdown-content unless the container is
    // :focus-within or .dropdown-open — React state alone isn't enough.
    const { container } = render(
      <MiniCalendar
        value={null}
        onChange={() => {}}
        placeholder="Pick a date"
        t={t}
        locale="en-US"
      />
    );
    const root = container.querySelector('.dropdown') as HTMLElement;
    expect(root.classList.contains('dropdown-open')).toBe(false);
    fireEvent.click(screen.getByText('Pick a date'));
    expect(root.classList.contains('dropdown-open')).toBe(true);
  });

  it('trigger has no tabindex (a [tabindex] trigger gets pointer-events:none on focus, so a real click never opens it)', () => {
    // The trigger is the first child of .dropdown. If it carries [tabindex],
    // DaisyUI's `.dropdown:focus-within > [tabindex]:first-child { pointer-events:none }`
    // fires the moment mousedown focuses it, so the ensuing click lands on the
    // parent .dropdown and the button's onClick never runs. happy-dom can't apply
    // that CSS, so we guard the root cause directly: the <button> stays focusable
    // natively and must NOT be marked [tabindex].
    render(
      <MiniCalendar value={null} onChange={() => {}} placeholder="Pick a date" t={t} locale="en-US" />
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
