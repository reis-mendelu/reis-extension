import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
    language: 'cs',
  }),
}));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({ useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }) }));

import { SubjectRow } from '../SubjectRow';
import { useAppStore } from '@/store/useAppStore';
import type { SubjectStatus } from '@/types/studyPlan';
import type { GradeHistory } from '@/types/documents';

const enrolledFailing: SubjectStatus = {
  id: '123456', code: 'EAK-AOS', name: 'Architektura operačních systémů', credits: 6, type: 'P',
  isEnrolled: true, isFulfilled: false, enrollmentCount: 1, rawStatusText: 'ZAPSÁNO',
};

const passedSubject: SubjectStatus = {
  id: '654321', code: 'EAK-DB', name: 'Databázové systémy', credits: 6, type: 'P',
  isEnrolled: false, isFulfilled: true, enrollmentCount: 1, rawStatusText: 'SPLNĚNO',
};

function seedGrade(predmetId: string, gradeLetter: string, attempt: number | null): void {
  const history: GradeHistory = {
    studium: 's1',
    fetchedAt: new Date().toISOString(),
    grades: [{
      period: 'ZS 2025/2026', predmetId, courseCode: undefined, courseName: 'x',
      examType: 'zk', attempt, gradeText: `text (${gradeLetter})`, gradeLetter, credits: 6,
    }],
  };
  useAppStore.setState({ gradeHistory: history });
}

describe('SubjectRow — failing-grade attempt indicator', () => {
  beforeEach(() => {
    useAppStore.setState({ gradeHistory: null });
  });

  const renderRow = (subject: SubjectStatus) =>
    render(<SubjectRow subject={subject} onOpenSubject={() => {}} onSearchSubject={() => {}} />);

  it('shows the attempt number next to an F grade on a still-enrolled subject', () => {
    seedGrade('123456', 'F', 1);
    renderRow(enrolledFailing);
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('subjects.grade.attempt:{"n":1}')).toBeInTheDocument();
  });

  it('does not show an attempt indicator for a passing grade', () => {
    seedGrade('654321', 'A', 2);
    renderRow(passedSubject);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText(/subjects\.grade\.attempt/)).not.toBeInTheDocument();
  });

  it('does not show an attempt indicator once the subject is fulfilled, even with a past F', () => {
    const fulfilledAfterRetake: SubjectStatus = { ...enrolledFailing, isEnrolled: false, isFulfilled: true };
    seedGrade('123456', 'F', 1);
    renderRow(fulfilledAfterRetake);
    expect(screen.queryByText(/subjects\.grade\.attempt/)).not.toBeInTheDocument();
  });
});
