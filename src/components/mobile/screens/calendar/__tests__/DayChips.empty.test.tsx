import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayChips } from '../DayChips';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * Which days hold something, without tapping them.
 *
 * "People click on days, just to find out they might be empty." The row said
 * nothing about content: every chip looked identical whether the day held four
 * lessons or none, so the only way to find out was to select it and read the
 * agenda. `lessonDates` was already being passed in for the weekend branch — it
 * just was not shown.
 *
 * A dot on the days that HAVE something, rather than dimming the ones that do
 * not. Dimming was the first attempt and it failed the contrast gate:
 * `text-base-content/40` measures 2.51:1 in the light theme, under the 4.5
 * floor, which made the empty days the hardest labels on the screen to read.
 * Every label stays at /70 now and presence is carried by the mark.
 */
describe('DayChips — which days hold something', () => {
  const setup = (lessonDates: string[], selectedIso = '2026-04-22') => {
    useAppStore.setState({ language: 'cz' } as never);
    return render(
      <DayChips selectedIso={selectedIso} onSelect={() => {}} lessonDates={new Set(lessonDates)} />
    );
  };

  // Mon 20 – Fri 24 April 2026, Wednesday selected. Lessons on Tuesday only.
  const chip = (label: RegExp) => screen.getByRole('button', { name: label });

  it('marks a day that has lessons', () => {
    setup(['20260421']);
    expect(chip(/^Út 21/).querySelector('[data-testid="day-chip-lessons"]')).not.toBeNull();
  });

  it('leaves an empty day unmarked', () => {
    setup(['20260421']);
    expect(chip(/^Po 20/).querySelector('[data-testid="day-chip-lessons"]')).toBeNull();
  });

  it('marks nothing across a week with nothing in it', () => {
    setup([]);
    expect(screen.queryAllByTestId('day-chip-lessons')).toHaveLength(0);
  });

  it('never dims a label below the contrast floor', () => {
    // The regression this replaced: /40 is 2.51:1 in the light theme.
    setup(['20260421']);
    for (const label of [/^Po 20/, /^Út 21/, /^Čt 23/, /^Pá 24/])
      expect(chip(label).className).not.toContain('text-base-content/40');
  });

  it('keeps every label at the same readable weight', () => {
    setup(['20260421']);
    expect(chip(/^Po 20/).className).toContain('text-base-content/70');
    expect(chip(/^Út 21/).className).toContain('text-base-content/70');
  });

  /**
   * A holiday outranks lessons on the same day: the closure is the more
   * surprising fact, and the banner above the agenda names it either way.
   */
  it('shows the holiday dot rather than the lesson dot when a day is both', () => {
    // 2026-04-06 is Easter Monday.
    setup(['20260406'], '2026-04-06');
    const easter = chip(/^Po 6/);
    expect(easter.querySelector('[data-testid="day-chip-holiday"]')).not.toBeNull();
    expect(easter.querySelector('[data-testid="day-chip-lessons"]')).toBeNull();
  });
});
