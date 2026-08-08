import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayChips } from '../DayChips';

/**
 * The chip row is the only way to reach another day on the phone, so what it
 * is anchored to is the whole feature.
 *
 * It used to take a `weekStart` prop fed from `schedule.weekStart`, which
 * sounds like "Monday of the fetched week" but is actually written by
 * `syncSchedule` as the SEMESTER start (Feb 1 / Sep 1). On a real device in
 * April the row therefore offered five days in February and the current week
 * was unreachable. Every existing test passed `weekStart: null`, and the mock
 * dataset happened to set it to a real Monday, so nothing caught it.
 */
describe('DayChips', () => {
  it('shows the week containing the selected day', async () => {
    render(<DayChips selectedIso="2026-04-22" onSelect={() => {}} />);

    // Wednesday 22 April 2026 → the Mon–Fri row is 20–24 April.
    expect(screen.getByRole('button', { name: /20/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /24/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /19/ })).not.toBeInTheDocument();
  });

  it('anchors on the selected day even when it is a Sunday', () => {
    // mondayOf() has to walk BACK from Sunday, not forward — getDay() is 0
    // there, which a naive `1 - day` sends into the following week.
    render(<DayChips selectedIso="2026-04-26" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /20/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /24/ })).toBeInTheDocument();
  });

  it('moves the selection a week forward', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayChips selectedIso="2026-04-22" onSelect={onSelect} />);

    await user.click(screen.getByLabelText('Další týden'));
    expect(onSelect).toHaveBeenCalledWith('2026-04-29');
  });

  it('moves the selection a week back, across a month boundary', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayChips selectedIso="2026-04-02" onSelect={onSelect} />);

    await user.click(screen.getByLabelText('Předchozí týden'));
    expect(onSelect).toHaveBeenCalledWith('2026-03-26');
  });

  it('selects the tapped day', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayChips selectedIso="2026-04-22" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /24/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-04-24');
  });
});
