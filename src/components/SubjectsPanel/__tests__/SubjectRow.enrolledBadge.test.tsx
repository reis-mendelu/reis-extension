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

const enrolled = (rawStatusText: string): SubjectStatus => ({
  id: '123456',
  code: 'ABTI',
  name: 'Ateliér bytového interiéru',
  credits: 5,
  type: 'zk',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText,
});

const row = (s: SubjectStatus) =>
  render(<SubjectRow subject={s} onOpenSubject={() => {}} onSearchSubject={() => {}} />);

/**
 * The enrolled badge used to print `rawStatusText` and nothing else. IS always
 * fills it ("ZAPSÁNO"), but two producers mark a row enrolled without IS text —
 * the impersonated plan (`catalogPlan`) and the Erasmus fallback plan — and the
 * badge then rendered as an empty green outline beside the name: "a checkbox,
 * kind of, I don't know what it is". Say what it means instead, as the
 * not-fulfilled badge beside it already does.
 */
describe('SubjectRow — enrolled badge', () => {
  it('names the status when IS gave no text', () => {
    row(enrolled(''));
    const badge = screen.getByText('subjects.enrolled');
    expect(badge.className).toContain('badge-primary');
  });

  it("keeps IS's own text when there is some", () => {
    row(enrolled('ZAPSÁNO'));
    expect(screen.getByText('ZAPSÁNO').className).toContain('badge-primary');
    expect(screen.queryByText('subjects.enrolled')).toBeNull();
  });
});
