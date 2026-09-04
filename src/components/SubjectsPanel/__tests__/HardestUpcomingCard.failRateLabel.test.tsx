import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HardestUpcomingCard } from '../HardestUpcomingCard';
import type { HardestEntry } from '../insights';

vi.mock('@/hooks/ui/useCourseName', () => ({
  useCourseName: (_code: string, name: string) => name,
}));

const entry = (name: string, rate: number): HardestEntry =>
  ({
    subject: { code: name.slice(0, 6), name, id: '1', isFulfilled: false },
    stat: { rate, students: 120 },
    semesters: [4],
  }) as unknown as HardestEntry;

/**
 * The same fix #265 made to `SubjectRow`, applied to the card that was missed.
 *
 * The label was here all along but behind `max-w-0 opacity-0 …
 * group-hover/fail:max-w-[140px]`. A touch screen has no hover, so on the iPad
 * these five rows showed bare colour-coded numbers — 45%, 41%, 32% — with
 * nothing saying what they were a percentage of, while every row in the
 * semester lists below said "prům. neúspěšnost" outright.
 *
 * Reported against both insight cards: "should directly show 'průměrná
 * neúspěšnost' as elsewhere in the study plan".
 */
// The real Czech string, not the i18n key: `useTranslation` resolves against
// cs.json in this suite, so asserting on a key would pass while the row
// rendered "subjects.failRateLabel" to a student.
const LABEL = 'prům. neúspěšnost';

describe('HardestUpcomingCard fail-rate label', () => {
  const entries = [entry('Ekonomie', 45), entry('Statistika', 41), entry('Matlab', 9)];

  const open = () => {
    render(
      <HardestUpcomingCard entries={entries} onOpenSubject={() => {}} onSearchSubject={() => {}} />
    );
    fireEvent.click(screen.getByText('Nejtěžší předměty, které tě čekají'));
  };

  it('names the rate on every row, the way the semester lists do', () => {
    open();

    expect(screen.getAllByText(LABEL)).toHaveLength(entries.length);
  });

  // The mechanism that made this invisible: zero width and zero opacity until
  // a hover that a finger cannot produce.
  it('does not hide the label behind a hover', () => {
    open();

    for (const label of screen.getAllByText(LABEL)) {
      expect(label.className).not.toContain('opacity-0');
      expect(label.className).not.toContain('max-w-0');
    }
  });

  it('still shows every row its own number', () => {
    open();

    for (const rate of [45, 41, 9]) {
      expect(screen.getByText(`${rate}%`)).toBeInTheDocument();
    }
  });

  it('says nothing at all while the card is collapsed', () => {
    render(
      <HardestUpcomingCard entries={entries} onOpenSubject={() => {}} onSearchSubject={() => {}} />
    );

    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
  });
});
