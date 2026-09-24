import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject, ExamTerm } from '../../types/exams';

const NOW = new Date(2026, 8, 20, 12, 0);

// Opens in 6 hours and closes in 30: both inside the alert windows.
const dates = { registrationStart: '20.09.2026 18:00', registrationEnd: '21.09.2026 18:00' };

const subjectWith = (term: ExamTerm): ExamSubject => ({
  version: 1,
  id: 'EBC',
  name: 'Ekonometrie',
  code: 'EBC',
  sections: [{ id: 's1', name: 'zkouška', type: 'exam', status: 'available', terms: [term] }],
});

/**
 * A term under "Kam se přihlásit nemohu?" keeps IS's registration dates, which
 * never open for this student — so "registration opens / closes soon" about it
 * is an alert they can do nothing with.
 */
describe('useDeadlineAlerts', () => {
  beforeEach(() => {
    useAppStore.setState({ now: NOW, odevzdavarny: [], cvicneTests: [], language: 'cz' } as never);
  });

  it('raises no registration alert for a term the student cannot register for', () => {
    const term = { id: 't1', date: '05.10.2026', time: '09:00', cannotRegister: true, ...dates };
    useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: [subjectWith(term)] } });
    const { result } = renderHook(() => useDeadlineAlerts());
    expect(result.current.alerts.filter((a) => a.type.startsWith('exam-'))).toEqual([]);
  });

  it('still raises them for a term the student can register for', () => {
    const term = { id: 't1', date: '05.10.2026', time: '09:00', ...dates };
    useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: [subjectWith(term)] } });
    const { result } = renderHook(() => useDeadlineAlerts());
    expect(result.current.alerts.map((a) => a.type)).toEqual(['exam-reg-opens']);
  });
});
