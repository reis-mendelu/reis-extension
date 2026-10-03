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
    // the same one the week grid's now-line reads.
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

  it('shows no mark in a week that does not contain today', () => {
    render(<DayChips selectedIso="2026-04-29" onSelect={() => {}} lessonDates={new Set()} />);
    expect(screen.queryByTestId('day-chip-today')).not.toBeInTheDocument();
  });

  it('gives a lesson-free Saturday a chip when it is today', () => {
    useAppStore.setState({ now: new Date(2026, 3, 25, 16, 17) });
    render(<DayChips selectedIso="2026-04-25" onSelect={() => {}} lessonDates={new Set()} />);
    expect(chip(25)).toHaveAttribute('aria-current', 'date');
    expect(screen.queryByRole('button', { name: /\b26\b/ })).not.toBeInTheDocument();
  });
});
