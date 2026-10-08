import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExamsData } from '../useExamsData';
import { useAppStore } from '../../../store/useAppStore';
import type { ExamSubject, ExamSection } from '../../../types/exams';

const section = (over: Partial<ExamSection>): ExamSection =>
  ({ id: 's1', name: 'Zkouška', status: 'open', type: 'exam', terms: [], ...over }) as ExamSection;

const setExams = (sections: ExamSection[]) => {
  const subject = {
    version: 1,
    id: 'ALG',
    code: 'ALG',
    name: 'Algoritmizace',
    sections,
  } as ExamSubject;
  useAppStore.setState((s) => ({ exams: { ...s.exams, data: [subject], status: 'success' } }));
};

describe('the sections the desktop exam panel lists', () => {
  beforeEach(() => {
    useAppStore.setState((s) => ({ exams: { ...s.exams, data: [], status: 'success' } }));
  });

  it('lists ordinary unregistered exam sections', () => {
    setExams([section({ name: 'Zkouška' })]);
    const { result } = renderHook(() => useExamsData());
    expect(result.current.sections.map((r) => r.section.name)).toEqual(['Zkouška']);
  });

  // Same bug as the phone's "Otevřené termíny": IS serves seminar-group signup
  // through the exam-terms table, and the desktop panel passed it straight
  // through on the identical `status !== 'registered'` test.
  it('drops seminar-group signup', () => {
    setExams([
      section({ id: 'a', name: 'Zápis na cvičení' }),
      section({ id: 'b', name: 'Zkouška' }),
    ]);
    const { result } = renderHook(() => useExamsData());
    expect(result.current.sections.map((r) => r.section.name)).toEqual(['Zkouška']);
  });

  it('keeps zápočet', () => {
    setExams([section({ name: 'Zápočet' })]);
    const { result } = renderHook(() => useExamsData());
    expect(result.current.sections.map((r) => r.section.name)).toEqual(['Zápočet']);
  });
});

/**
 * Návrhy #26 on the desktop tree. The phone's ExamsScreen shows ScreenError
 * when a settled sync never got an answer about exams; the extension's panel
 * had no such branch and said "no exams" instead.
 */
describe('the desktop exam panel after a sync that could not reach IS', () => {
  beforeEach(() => {
    useAppStore.setState((s) => ({
      exams: { ...s.exams, data: [], status: 'success' },
      firstSyncSettled: true,
      syncLoaded: {},
      syncStatus: { ...s.syncStatus, isSyncing: false, handshakeDone: true },
    }));
  });

  it('is a failure, not an empty list', () => {
    const { result } = renderHook(() => useExamsData());
    expect(result.current.showFailed).toBe(true);
  });

  it('is an empty list when IS answered "none"', () => {
    useAppStore.setState({ syncLoaded: { exams: true } });
    const { result } = renderHook(() => useExamsData());
    expect(result.current.showFailed).toBe(false);
  });

  it('is neither while the first sync is still running', () => {
    useAppStore.setState({ firstSyncSettled: false });
    const { result } = renderHook(() => useExamsData());
    expect(result.current.showFailed).toBe(false);
  });

  it('shows cached exams over the failure', () => {
    setExams([section({ name: 'Zkouška' })]);
    const { result } = renderHook(() => useExamsData());
    expect(result.current.showFailed).toBe(false);
  });
});
