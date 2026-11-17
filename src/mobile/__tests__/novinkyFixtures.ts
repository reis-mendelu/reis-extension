import { vi } from 'vitest';
import type { ExamSubject } from '../../types/exams';

/**
 * Shared by the novinkyNotifications tests. The mocks themselves stay in each
 * test file: vi.mock is hoisted per file.
 */
export const NOW = new Date(2026, 11, 1, 12, 0);

export const vwa: ExamSubject = {
  version: 1,
  id: 'EBC-VWA',
  name: 'Vývoj webových aplikací',
  code: 'EBC-VWA',
  sections: [
    {
      id: 'zk',
      name: 'zkouška',
      type: 'exam',
      status: 'open',
      terms: [
        { id: '1', date: '14.12.2026', time: '11:00' },
        { id: '2', date: '17.12.2026', time: '11:00' },
      ],
    },
  ],
};

export const event = {
  id: 'ev1',
  title: 'Deskovky',
  body: '',
  associationId: 'supef',
  createdAt: '',
  expiresAt: '2026-12-02T18:00:00Z',
  priority: 'normal' as const,
};

export const notice = (key: string, from: string | null) => ({
  key,
  title: 'Výpadek Microsoft 365',
  text: 'Outlook, Teams',
  link: null,
  severity: 'info' as const,
  from,
  until: null,
});

/** Runs the settle timer, then lets the run's awaits finish. */
export async function settle() {
  await vi.advanceTimersByTimeAsync(2000);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** A signed-in student with one exam subject, after the first sync. */
export function baseState(notifications: object) {
  return {
    now: NOW,
    language: 'cz',
    firstSyncSettled: true,
    exams: { data: [vwa], status: 'success', error: null },
    examTermsNew: [],
    odevzdavarny: [],
    odevzdavarnyNew: [],
    zaznamnikNewPoints: {},
    societies: { supef: { name: 'SU PEF' } },
    notifySocieties: true,
    isNoticeMutes: [],
    isNoticesFetchedAt: null,
    isNoticesTriedAt: null,
    mobileSheets: [],
    isNotices: { cz: [], en: [] },
    notifications: {
      ...notifications,
      data: [],
      status: 'success',
      readIds: new Set(),
      seenDeadlineAlertIds: new Set(),
    },
  };
}
