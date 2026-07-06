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
