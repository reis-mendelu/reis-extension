import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useAppStore } from '../../store/useAppStore';
import type { Odevzdavarna } from '../../api/odevzdavarny';

const NOW = new Date(2026, 9, 3, 12, 0);

const box = (over: Partial<Odevzdavarna>): Odevzdavarna => ({
  courseId: '1',
  courseNameCs: 'Java',
  courseNameEn: 'Java',
  name: 'Projekt',
  type: '',
  deadline: '04.10.2026 10:00', // 22 h away
  odevzdavarnaId: '7',
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  ...over,
});

/**
 * The sync now reads all three IS tables, so the list holds boxes the student
 * cannot upload to ("Kam nemohu odevzdávat") — some with a deadline ahead.
 * "Due in 22 h" about one of those is an alert they can do nothing with.
 */
describe('useDeadlineAlerts — submission boxes', () => {
  beforeEach(() => {
    useAppStore.setState({ now: NOW, cvicneTests: [], language: 'cz' } as never);
  });

  const alertsFor = (boxes: Odevzdavarna[]) => {
    useAppStore.setState({ odevzdavarny: boxes });
    return renderHook(() => useDeadlineAlerts()).result.current.alerts.filter(
      (a) => a.type === 'assignment'
    );
  };

  it('alerts for an open box with nothing uploaded', () => {
    expect(alertsFor([box({ section: 'open', isOpen: true })])).toHaveLength(1);
  });

  it('still alerts for a row cached by an older build (no isOpen)', () => {
    expect(alertsFor([box({})])).toHaveLength(1);
  });

  it('does not alert for a box IS lists as closed to the student', () => {
    expect(alertsFor([box({ section: 'closed', isOpen: false })])).toEqual([]);
  });
});
