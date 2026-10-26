import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../../../store/useAppStore';
import { DayChips } from '../DayChips';

/**
 * "I just don't know what day is today" — Dominik, Saturday 3 October 2026.
 * The strip marked only the SELECTED day, and on a lesson-free Saturday it had
 * no chip for today at all. Google Calendar answers the question with a filled
 * circle on today's date, whatever is selected; so does this strip now.
 */
describe('DayChips today mark', () => {
  beforeEach(() => {
    // Wednesday 22 April 2026, mid-morning. The mark reads the store's clock,
    // the same one the header and the agenda read.
    useAppStore.setState({ now: new Date(2026, 3, 22, 10, 0) });
  });

  const chip = (day: number) => screen.getByRole('button', { name: new RegExp(`\\b${day}\\b`) });

  it('marks today with aria-current="date" and a filled circle', () => {
    render(<DayChips selectedIso="2026-04-22" onSelect={() => {}} lessonDates={new Set()} />);
    expect(chip(22)).toHaveAttribute('aria-current', 'date');
    expect(screen.getByTestId('day-chip-today').className).toContain('bg-primary');
    expect(screen.getByTestId('day-chip-today').className).toContain('text-primary-content');
    expect(screen.getByTestId('day-chip-today')).toHaveTextContent('22');
  });

  it('keeps the mark on today when another day is selected', () => {
    render(<DayChips selectedIso="2026-04-24" onSelect={() => {}} lessonDates={new Set()} />);
    expect(chip(22)).toHaveAttribute('aria-current', 'date');
    expect(chip(24)).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('day-chip-today')).toHaveTextContent('22');
  });

  /**
   * "When I go back to Friday, it doesn't change. How do I know if I'm on
   * Friday?" — Dominik, Friday 9 October 2026. Today's chip drew the same
   * filled circle selected or not, so stepping back onto today showed nothing.
   * Today keeps its mark either way, but only fills in while it is the agenda's
   * day; with another day picked it is a ring.
   */
  it('fills the today mark only while today is the selected day', () => {
    const { unmount } = render(
      <DayChips selectedIso="2026-04-22" onSelect={() => {}} lessonDates={new Set()} />
    );
    const selected = screen.getByTestId('day-chip-today').className;
    unmount();
    const { unmount: unmountOther } = render(
      <DayChips selectedIso="2026-04-23" onSelect={() => {}} lessonDates={new Set()} />
    );
    const other = screen.getByTestId('day-chip-today').className;
    unmountOther();

    expect(selected).toContain('bg-primary');
    expect(other).not.toContain('bg-primary');
    // The ring's ink is the contrast-safe tone, not raw `primary` (under 3:1 in light).
    expect(other).toContain('ring-[1.5px]');
    expect(other).toContain('ring-[var(--tone-primary)]');
    expect(other).not.toBe(selected);
  });

  it('shows no mark in a week that does not contain today', () => {
    render(<DayChips selectedIso="2026-04-29" onSelect={() => {}} lessonDates={new Set()} />);
    expect(screen.queryByTestId('day-chip-today')).not.toBeInTheDocument();
  });

  /**
   * "When I switch to a next week, the 9th of October gets highlighted as the
   * current day even though it's not" — Saturday 3 October 2026. The arrow
   * kept a selected day (Friday 9, the nearest to a hidden Saturday) and the
   * strip drew it as the week's only tonal pill, which read as "today". No
   * chip draws a pill now: the filled circle is the strip's one coloured mark.
   */
  it('draws no pill, only the today mark', () => {
    useAppStore.setState({ now: new Date(2026, 9, 3, 16, 0) });
    const { unmount } = render(
      <DayChips selectedIso="2026-10-09" onSelect={() => {}} lessonDates={new Set()} />
    );
    expect(chip(9).className).not.toContain('bg-primary');
    expect(chip(9).className).not.toContain('tone-primary');
    unmount();
    render(<DayChips selectedIso="2026-10-02" onSelect={() => {}} lessonDates={new Set()} />);
    expect(chip(2).className).not.toContain('bg-primary');
    expect(chip(3)).toHaveAttribute('aria-current', 'date');
  });

  /**
   * Without the pill the selection is weight and ink only, which a screen
   * reader does not hear: the chips are a pick-one row and say which is pressed.
   */
  it('exposes the agenda day as pressed', () => {
    useAppStore.setState({ now: new Date(2026, 9, 3, 16, 0) });
    render(<DayChips selectedIso="2026-10-09" onSelect={() => {}} lessonDates={new Set()} />);
    expect(chip(9)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(8)).toHaveAttribute('aria-pressed', 'false');
  });

  it('gives a lesson-free Saturday a chip when it is today', () => {
    useAppStore.setState({ now: new Date(2026, 3, 25, 16, 17) });
    render(<DayChips selectedIso="2026-04-25" onSelect={() => {}} lessonDates={new Set()} />);
    expect(chip(25)).toHaveAttribute('aria-current', 'date');
    expect(screen.queryByRole('button', { name: /\b26\b/ })).not.toBeInTheDocument();
  });
});
