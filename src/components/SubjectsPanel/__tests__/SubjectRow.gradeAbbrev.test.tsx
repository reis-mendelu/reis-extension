import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SubjectRow } from '../SubjectRow';
import { useAppStore } from '@/store/useAppStore';
import type { SubjectStatus } from '@/types/studyPlan';

const subject: SubjectStatus = {
  id: '123456',
  code: 'EBC-OT',
  name: 'Odborná terminologie',
  credits: 2,
  type: 'Záp',
  isEnrolled: false,
  isFulfilled: true,
  fulfillmentDate: '15.12.2025',
  enrollmentCount: 1,
  rawStatusText: 'SPLNĚNO',
};

/**
 * "započteno" spelled out is nine characters of a row that also has to carry a
 * name, a date and a tick — at 320px it pushed the subject's own name out.
 * IS's own suffixes are (zap) and (zak), so the badge says ZAP and ZAK.
 */
describe('SubjectRow completion badge', () => {
  beforeEach(() => {
    useAppStore.setState({
      gradeHistory: {
        grades: [
          {
            predmetId: '123456',
            courseCode: 'EBC-OT',
            courseName: 'Odborná terminologie',
            gradeLetter: '',
            gradeText: 'započteno (zap)',
            attempt: 1,
            date: '15.12.2025',
          },
        ],
      },
      successRates: {},
    } as never);
  });

  it('abbreviates a zápočet to ZAP', () => {
    render(<SubjectRow subject={subject} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    expect(screen.getByText('ZAP')).toBeInTheDocument();
    expect(screen.queryByText(/započteno/i)).not.toBeInTheDocument();
  });
});
