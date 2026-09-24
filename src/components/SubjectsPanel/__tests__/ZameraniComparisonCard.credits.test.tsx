import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZameraniComparisonCard } from '../ZameraniComparisonCard';
import type { ZameraniInsight } from '../insights';

const insight = {
  name: 'Vývoj webových aplikací',
  totalCredits: 20,
  description: '',
  subjects: [{ code: 'EBC-WGD', name: 'Webová grafika', id: '1', stat: null }],
} as unknown as ZameraniInsight;

/**
 * The zaměření total printed its unit only from `md` up, so a phone showed a
 * bare "20" beside the name — the same `hidden md:inline` that hid the credits
 * on every subject row. `useTranslation` resolves against cs.json here.
 */
describe('ZameraniComparisonCard credits', () => {
  it('says what the total counts at phone width', () => {
    render(
      <ZameraniComparisonCard
        insights={[insight, { ...insight, name: 'Řízení podniku' }]}
        picks={new Set()}
        onTogglePick={() => {}}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Srovnání zaměření'));

    const totals = screen.getAllByText('20 kr.');
    expect(totals).toHaveLength(2);
    expect(totals[0]?.querySelector('.hidden')).toBeNull();
  });
});
