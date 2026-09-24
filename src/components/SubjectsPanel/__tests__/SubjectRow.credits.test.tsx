import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'cs' }),
}));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SubjectRow } from '../SubjectRow';
import type { SubjectStatus } from '@/types/studyPlan';

const subject: SubjectStatus = {
  id: '123456',
  code: 'EAK-AOS',
  name: 'Architektura operačních systémů',
  credits: 6,
  type: 'P',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 1,
  rawStatusText: 'ZAPSÁNO',
};

/**
 * Credits are the number a student plans a semester with, and the study plan
 * on a phone had dropped them: the cell carried `hidden md:inline`, so it only
 * ever showed on a desktop-width screen.
 */
describe('SubjectRow — credits', () => {
  const creditCell = () => screen.getByText('6 kr.');

  it('shows the credits at phone width', () => {
    render(<SubjectRow subject={subject} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    expect(creditCell().className).not.toMatch(/\bhidden\b/);
  });

  it('shows them in the compact row too', () => {
    render(
      <SubjectRow subject={subject} compact onOpenSubject={() => {}} onSearchSubject={() => {}} />
    );
    expect(creditCell().className).not.toMatch(/\bhidden\b/);
  });
});
