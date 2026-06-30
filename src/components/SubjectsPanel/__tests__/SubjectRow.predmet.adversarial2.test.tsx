import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k, language: 'cs' }) }));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({ useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }) }));

import { SubjectRow } from '../SubjectRow';
import { useAppStore } from '@/store/useAppStore';
import type { SubjectStatus } from '@/types/studyPlan';

const enrolledWithId: SubjectStatus = {
  id: '99999', code: 'EBC-ZUI', name: 'Základy umělé inteligence', credits: 5, type: 'P',
  isEnrolled: true, isFulfilled: false, enrollmentCount: 1, rawStatusText: 'Zapsáno',
};

const notEnrolled: SubjectStatus = {
  id: '', code: 'EBC-ZUI', name: 'Základy umělé inteligence', credits: 5, type: 'P',
  isEnrolled: false, isFulfilled: false, enrollmentCount: 0, rawStatusText: '',
};

const seedRate = (predmetId?: string) =>
  useAppStore.setState({ successRates: predmetId === undefined ? {} : { 'EBC-ZUI': { courseCode: 'EBC-ZUI', stats: [], lastUpdated: '', predmetId } } });

describe('SubjectRow predmet-id precedence (adversarial)', () => {
  let onOpenSubject: ReturnType<typeof vi.fn>;
  let onSearchSubject: ReturnType<typeof vi.fn>;
  beforeEach(() => { onOpenSubject = vi.fn(); onSearchSubject = vi.fn(); });

  it('an enrolled subject with its own id ignores success-rate predmetId entirely, even when the latter is junk', async () => {
    seedRate('3'); // deliberately junk — must never matter, subject.id wins outright
    render(<SubjectRow subject={enrolledWithId} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenSubject).toHaveBeenCalledWith('EBC-ZUI', 'Základy umělé inteligence', '99999', undefined, undefined, false);
  });

  it('an enrolled subject with its own id ignores success-rate predmetId when there is no record at all', async () => {
    seedRate(undefined);
    render(<SubjectRow subject={enrolledWithId} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenSubject).toHaveBeenCalledWith('EBC-ZUI', 'Základy umělé inteligence', '99999', undefined, undefined, false);
  });

  it('falls back to search (not crash) when success-rate map has no entry for the subject code at all', async () => {
    useAppStore.setState({ successRates: {} });
    render(<SubjectRow subject={notEnrolled} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSearchSubject).toHaveBeenCalledWith('Základy umělé inteligence');
    expect(onOpenSubject).not.toHaveBeenCalled();
  });

  it('treats whitespace-only predmetId as invalid (regex requires digits, not just length)', async () => {
    seedRate('     ');
    render(<SubjectRow subject={notEnrolled} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSearchSubject).toHaveBeenCalledWith('Základy umělé inteligence');
    expect(onOpenSubject).not.toHaveBeenCalled();
  });

  it('accepts a 6-digit predmetId and opens the drawer directly (boundary above the 5-digit floor)', async () => {
    seedRate('123456');
    render(<SubjectRow subject={notEnrolled} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenSubject).toHaveBeenCalledWith('EBC-ZUI', 'Základy umělé inteligence', '123456', undefined, undefined, false);
  });

  it('does not crash and falls back to search on a negative-looking id ("-12345")', async () => {
    seedRate('-12345');
    render(<SubjectRow subject={notEnrolled} onOpenSubject={onOpenSubject} onSearchSubject={onSearchSubject} />);
    await userEvent.click(screen.getByRole('button'));
    // "-12345" fails ^\d{5,}$ because of the leading "-", so it must fall back to search.
    expect(onSearchSubject).toHaveBeenCalledWith('Základy umělé inteligence');
    expect(onOpenSubject).not.toHaveBeenCalled();
  });
});
