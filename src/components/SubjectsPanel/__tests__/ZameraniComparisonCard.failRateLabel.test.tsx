import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZameraniComparisonCard } from '../ZameraniComparisonCard';
import type { ZameraniInsight } from '../insights';

const insight = (name: string, subjects: Array<[string, string, number | null]>): ZameraniInsight =>
  ({
    name,
    totalCredits: 20,
    description: '',
    subjects: subjects.map(([code, subjName, rate]) => ({
      code,
      name: subjName,
      id: code,
      stat: rate === null ? null : { rate, students: 120 },
    })),
  }) as unknown as ZameraniInsight;

/**
 * "predmety in srovnani zamereni: don't show 'prumerna neúspěšnost' label"
 *
 * A statement of the defect, not a request to remove it: the subject rows in
 * this card showed a bare "0%" / "11%" chip while every row in the semester
 * lists on the same screen said "prům. neúspěšnost" in full. Confirmed against
 * the rendered chip — "should directly show 'průměrná neúspěšnost' as elsewhere
 * in the study plan".
 *
 * Same reasoning as #265, which fixed exactly this in `SubjectRow`: a
 * colour-coded number with no name is not readable, and on a touch screen there
 * is no hover to reveal one.
 */
// The real Czech string, not the i18n key: `useTranslation` resolves against
// cs.json in this suite, so asserting on a key would pass while the row
// rendered "subjects.failRateLabel" to a student.
const LABEL = 'prům. neúspěšnost';

describe('ZameraniComparisonCard fail-rate label', () => {
  const insights = [
    insight('Vývoj webových aplikací', [
      ['EBC-WGD', 'Webová grafika a design', 11],
      ['EBC-WAF', 'Webové aplikace: frontend', 0],
    ]),
    insight('Řízení podniku', [['EBC-RP', 'Řízení podniku', 25]]),
  ];

  const openFirstZamerani = () => {
    render(
      <ZameraniComparisonCard
        insights={insights}
        picks={new Set()}
        onTogglePick={() => {}}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Srovnání zaměření'));
    fireEvent.click(screen.getByText('Vývoj webových aplikací'));
  };

  it('names the rate on each subject row', () => {
    openFirstZamerani();

    expect(screen.getAllByText(LABEL)).toHaveLength(2);
  });

  it('keeps the number itself', () => {
    openFirstZamerani();

    expect(screen.getByText('11%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('does not hide the label behind a hover', () => {
    openFirstZamerani();

    for (const label of screen.getAllByText(LABEL)) {
      expect(label.className).not.toContain('opacity-0');
      expect(label.className).not.toContain('max-w-0');
    }
  });

  // A subject with no statistics shows an em dash. There is no rate, so there
  // is nothing to name — the same rule `SubjectRow` follows.
  it('says nothing where there is no rate to name', () => {
    render(
      <ZameraniComparisonCard
        insights={[
          insight('Bez dat', [['EBC-X', 'Předmět bez statistik', null]]),
          insight('Druhé', [['EBC-Y', 'Jiný předmět', 5]]),
        ]}
        picks={new Set()}
        onTogglePick={() => {}}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Srovnání zaměření'));
    fireEvent.click(screen.getByText('Bez dat'));

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
  });
});
