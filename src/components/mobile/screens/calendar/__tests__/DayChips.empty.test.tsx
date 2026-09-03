import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayChips } from '../DayChips';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * Which days are empty, without tapping them.
 *
 * "People click on days, just to find out they might be empty." The row said
 * nothing about content: every chip looked identical whether the day held four
 * lessons or none, so the only way to find out was to select it and read the
 * agenda. `lessonDates` was already being passed in for the weekend branch —
 * it just was not shown.
 *
 * Dimmed rather than dotted: a dot would collide with the holiday dot in the
 * same spot, and "nothing here" is better said by absence than by another mark.
 */
describe('DayChips — empty days', () => {
  const setup = (lessonDates: string[]) => {
    useAppStore.setState({ language: 'cz' } as never);
    return render(
      <DayChips selectedIso="2026-04-22" onSelect={() => {}} lessonDates={new Set(lessonDates)} />
    );
  };

  // Mon 20 – Fri 24 April 2026. Lessons on Tuesday only.
  const chip = (label: RegExp) => screen.getByRole('button', { name: label });

  it('dims a day with nothing on it', () => {
    // Monday is empty; Tuesday is the one with lessons.
    setup(['20260421']);
    expect(chip(/^Po 20$/).className).toContain('text-base-content/40');
  });

  it('leaves a day that has lessons at full strength', () => {
    setup(['20260421']);
    expect(chip(/^Út 21$/).className).not.toContain('text-base-content/40');
  });

  it('does not dim the selected day, empty or not', () => {
    // The selected chip is the one the agenda is already answering for, so it
    // keeps its own treatment.
    setup(['20260421']);
    expect(chip(/^St 22$/).className).toContain('text-primary');
    expect(chip(/^St 22$/).className).not.toContain('text-base-content/40');
  });

  it('dims every day of a week with nothing in it', () => {
    setup([]);
    for (const label of [/^Po 20$/, /^Út 21$/, /^Čt 23$/, /^Pá 24$/])
      expect(chip(label).className).toContain('text-base-content/40');
  });
});
