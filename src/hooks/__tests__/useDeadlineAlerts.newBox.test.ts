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

  // The urgent new-box row stood in for the deadline row; once it is seen and
  // the box opened, the deadline row that comes back is not counted again.
  it('the deadline row that comes back is already seen with its urgent new-box row', () => {
    useAppStore.setState({
      odevzdavarnyNew: [],
      notifications: {
        ...useAppStore.getState().notifications,
        seenDeadlineAlertIds: new Set(['odev-new-7@48h']),
      },
    } as never);
    const { alerts, unseenCount } = renderHook(() => useDeadlineAlerts()).result.current;
    expect(alerts.map((a) => a.id)).toEqual(['odev-7']);
    expect(unseenCount).toBe(0);
  });

  // Seen weeks before the deadline, the new-box row says nothing about the
  // 48-hour warning that comes later: that one is news of its own.
  it('a new-box row seen while it was far off does not silence the 48-hour warning', () => {
    useAppStore.setState({
      odevzdavarnyNew: [],
      notifications: {
        ...useAppStore.getState().notifications,
        seenDeadlineAlertIds: new Set(['odev-new-7']),
      },
    } as never);
    expect(renderHook(() => useDeadlineAlerts()).result.current.unseenCount).toBe(1);
  });

  it('a new box turning urgent while unseen lights the bell again', () => {
    useAppStore.setState({
      odevzdavarnyNew: ['7'],
      notifications: {
        ...useAppStore.getState().notifications,
        seenDeadlineAlertIds: new Set(['odev-new-7']),
      },
    } as never);
    const { alerts, unseenCount } = renderHook(() => useDeadlineAlerts()).result.current;
    expect(alerts.map((a) => a.id)).toEqual(['odev-new-7@48h']);
    expect(unseenCount).toBe(1);
  });
});
