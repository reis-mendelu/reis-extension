import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { CalendarScreen } from '../CalendarScreen';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

const HELD = 'min-h-[calc(100%+1px)]';

/** The content box straight inside a tab's scroller must be held one pixel
 *  taller than it — see AlwaysScrollable. Checked per tab, because each tab
 *  builds its own scroller and a new one silently forgets. */
function expectAlwaysScrollable(scroller: HTMLElement) {
  expect(
    getComputedStyle(scroller).overflowY === 'auto' ||
      scroller.className.includes('overflow-y-auto')
  ).toBe(true);
  expect((scroller.firstElementChild as HTMLElement).className).toContain(HELD);
}

describe('every tab can be dragged, even when it fits', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      now: new Date(2026, 8, 21, 12, 0),
      mobileSheets: [],
      mobileSelectedDayIso: '2026-09-21',
      schedule: { data: [], status: 'success' },
      firstSyncSettled: true,
      syncLoaded: { schedule: true, exams: true },
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      exams: {
        data: [
          {
            version: 1,
            id: 'sub-1',
            name: 'Ekonometrie 1',
            code: 'EBC-EKM',
            sections: [
              {
                id: 'sec-1',
                name: 'Zkouška',
                type: 'exam',
                status: 'available',
                terms: [{ id: 't1', date: '15.12.2026', time: '09:00', canRegisterNow: true }],
              },
            ],
          },
        ],
        status: 'success',
        error: null,
      },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
      fullName: 'Jana Nováková',
      studentId: '123456',
      hiddenItems: { events: [], courses: [] },
    } as never);
  });
  afterEach(cleanup);

  it('Zkoušky', () => {
    render(<ExamsScreen />);
    expectAlwaysScrollable(screen.getByTestId('exam-list'));
  });

  it('Kalendář', () => {
    render(<CalendarScreen />);
    expectAlwaysScrollable(screen.getByTestId('day-body'));
  });

  it('Profil', () => {
    render(<ProfileScreen />);
    expectAlwaysScrollable(screen.getByTestId('profile-scroll'));
  });
});
