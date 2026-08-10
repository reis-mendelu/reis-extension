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
    render(<DayChips selectedIso="2026-04-22" onSelect={() => {}} lessonDates={new Set()} />);

    // Wednesday 22 April 2026 → the Mon–Fri row is 20–24 April.
    expect(screen.getByRole('button', { name: /20/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /24/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /19/ })).not.toBeInTheDocument();
  });

  it('anchors on the selected day even when it is a Sunday', () => {
    // mondayOf() has to walk BACK from Sunday, not forward — getDay() is 0
    // there, which a naive `1 - day` sends into the following week.
    render(<DayChips selectedIso="2026-04-26" onSelect={() => {}} lessonDates={new Set()} />);
    expect(screen.getByRole('button', { name: /20/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /24/ })).toBeInTheDocument();
  });

  it('moves the selection a week forward', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayChips selectedIso="2026-04-22" onSelect={onSelect} lessonDates={new Set()} />);

    await user.click(screen.getByLabelText('Další týden'));
    expect(onSelect).toHaveBeenCalledWith('2026-04-29');
  });

  it('moves the selection a week back, across a month boundary', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayChips selectedIso="2026-04-02" onSelect={onSelect} lessonDates={new Set()} />);

    await user.click(screen.getByLabelText('Předchozí týden'));
    expect(onSelect).toHaveBeenCalledWith('2026-03-26');
  });

  it('adds a weekend chip when that day actually has a lesson', () => {
    // MENDELU teaches combined-study cohorts on Saturdays, and the desktop
    // week grid carries all seven days. A fixed Mon–Fri row on the phone made
    // those lessons unreachable: the agenda follows the selected day, and no
    // chip could ever select a Saturday.
    render(
      <DayChips selectedIso="2026-04-22" onSelect={() => {}} lessonDates={new Set(['20260425'])} />
    );
    expect(screen.getByRole('button', { name: /25/ })).toBeInTheDocument();
    // Sunday has nothing, so it stays out rather than padding the row.
    expect(screen.queryByRole('button', { name: /26/ })).not.toBeInTheDocument();
  });

  it('does not add a weekend chip just because that day is selected', () => {
    // Opening the app on a free Saturday leaves the row at Mon–Fri with nothing
    // highlighted; the header still names the day. Deliberate: a lesson is the
    // only thing that earns a sixth chip, so the ordinary week keeps five
    // even-width ones.
    render(<DayChips selectedIso="2026-04-25" onSelect={() => {}} lessonDates={new Set()} />);
    expect(screen.queryByRole('button', { name: /25/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /24/ })).toBeInTheDocument();
  });

  it('keeps the row to Mon–Fri when nothing needs a weekend', () => {
    render(<DayChips selectedIso="2026-04-22" onSelect={() => {}} lessonDates={new Set()} />);
    expect(screen.queryByRole('button', { name: /25/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /26/ })).not.toBeInTheDocument();
  });

  it('selects the tapped day', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayChips selectedIso="2026-04-22" onSelect={onSelect} lessonDates={new Set()} />);

    await user.click(screen.getByRole('button', { name: /24/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-04-24');
  });
});
