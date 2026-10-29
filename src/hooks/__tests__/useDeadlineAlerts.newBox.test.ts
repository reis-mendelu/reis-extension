import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useAppStore } from '../../store/useAppStore';
import type { Odevzdavarna } from '../../api/odevzdavarny';

const NOW = new Date(2026, 9, 3, 12, 0);

const box: Odevzdavarna = {
  courseId: '1',
  courseNameCs: 'Java',
  courseNameEn: 'Java',
  name: 'Projekt',
  type: '',
  deadline: '04.10.2026 10:00', // 22 h away: a deadline row too
  odevzdavarnaId: '7',
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  section: 'open',
  isOpen: true,
};

describe('useDeadlineAlerts — new odevzdávárna', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      cvicneTests: [],
      exams: { data: [] },
      language: 'cz',
      courseNicknames: {},
      zaznamnikNewPoints: {},
      subjects: { data: { 'EBC-PJ': { nameCs: 'Java', subjectId: '1' } } },
      odevzdavarny: [box],
    } as never);
  });

  const alerts = () => renderHook(() => useDeadlineAlerts()).result.current.alerts;

  it('a new box is one row, first, in place of its deadline row', () => {
    useAppStore.setState({ odevzdavarnyNew: ['7'] } as never);
    expect(alerts().map((a) => a.type)).toEqual(['assignment-new']);
  });

  it('once seen, the box is back to an ordinary deadline row', () => {
    useAppStore.setState({ odevzdavarnyNew: [] } as never);
    expect(alerts().map((a) => a.type)).toEqual(['assignment']);
  });

  // Tapping the new-box row clears it, and the box's own deadline row comes
  // back: the bell must not count that box a second time.
  it('the deadline row that comes back is already seen with its new-box row', () => {
    useAppStore.setState({
      odevzdavarnyNew: [],
      notifications: {
        ...useAppStore.getState().notifications,
        seenDeadlineAlertIds: new Set(['odev-new-7']),
      },
    } as never);
    const { alerts, unseenCount } = renderHook(() => useDeadlineAlerts()).result.current;
    expect(alerts.map((a) => a.id)).toEqual(['odev-7']);
    expect(unseenCount).toBe(0);
  });
});
