import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useAppStore } from '../../store/useAppStore';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import type { ExamSubject } from '../../types/exams';

const NOW = new Date(2026, 9, 3, 12, 0);

/**
 * A deadline alert is titled with its subject, so a renamed subject is titled
 * with its nickname — in the phone's Notifications sheet and the extension's
 * bell alike, since both read this hook.
 */
describe('useDeadlineAlerts — nicknames', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      cvicneTests: [],
      odevzdavarny: [],
      exams: { data: [], status: 'success', error: null },
      subjects: { version: 1, lastUpdated: '', data: {} },
      courseNicknames: { 'EBC-PJ': 'Java', 'EBC-MAN': 'Mňam' },
    } as never);
  });

  const alerts = () => renderHook(() => useDeadlineAlerts()).result.current.alerts;

  it('titles a submission-box alert with the nickname', () => {
    const box: Odevzdavarna = {
      courseId: '1',
      courseCode: 'EBC-PJ',
      courseNameCs: 'Programovací jazyk Java',
      courseNameEn: 'Java Programming Language',
      name: 'Projekt',
      type: '',
      deadline: '04.10.2026 10:00',
      odevzdavarnaId: '7',
      fileCount: 0,
      uploadUrl: 'https://is.mendelu.cz/x',
      isOpen: true,
    };
    useAppStore.setState({ odevzdavarny: [box] });
    expect(alerts().map((a) => a.title)).toEqual(['Java']);
  });

  it('titles an exam-registration alert with the nickname', () => {
    const exam = {
      id: 'man',
      code: 'EBC-MAN',
      name: 'Management',
      sections: [
        {
          id: 's',
          name: 'zkouška',
          type: 'exam',
          status: 'available',
          terms: [
            {
              id: 't',
              date: '20.10.2026',
              time: '09:00',
              registrationEnd: '04.10.2026 10:00',
            },
          ],
        },
      ],
    } as unknown as ExamSubject;
    useAppStore.setState({ exams: { data: [exam], status: 'success', error: null } } as never);
    expect(alerts().map((a) => a.title)).toEqual(['Mňam']);
  });
});
