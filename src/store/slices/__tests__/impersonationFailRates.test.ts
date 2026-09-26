import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchImpersonation = vi.fn();
vi.mock('../../../services/admin/hasAdminSession', () => ({ hasAdminSession: async () => false }));
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => fetchImpersonation(...a),
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import type { ImpersonationResult, ImpersonationSelection } from '../../../api/impersonation/types';

/**
 * Fail rates for the whole impersonated plan, not just this semester.
 *
 * A first-year's plan: semester 1 is what they attend (`subjects`), semesters
 * 2+ are only in the plan. The study plan screen shows a fail rate on every
 * row, and the overlay guard keeps `fetchStudyPlan` — the plan-wide batch —
 * from running, so this slice is the only thing that can ask for them.
 * Measured on a Pixel: only semester 1 had chips; each later row had to be
 * tapped open before its rate appeared.
 */
const subject = (code: string) => ({
  id: '',
  code,
  name: code,
  type: 'zk',
  credits: 5,
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: '',
});
const block = (title: string, codes: string[]) => ({
  title,
  groups: [{ name: '', statusDescription: '', subjects: codes.map(subject) }],
});
const plan = {
  title: 'N-DESG',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 120,
  blocks: [block('1', ['S1-A']), block('2', ['S2-A', 'S2-B'])],
};
const rozvrh = {
  id: '1',
  z: '20260921',
  k: '20261213',
  label: '',
  period: 'ZS 2026/2027',
  faculty: 'LDF',
  form: 'prezenční',
  start: '21.09.2026',
  end: '20.12.2026',
};
const RESULT: ImpersonationResult = {
  resolved: { programId: '1', shortCode: 'N-DESG', rozvrh },
  plan: { cz: plan, en: plan },
  schedule: [],
  subjects: { version: 1, lastUpdated: 'x', data: { 'S1-A': {} as never } },
  fetchedAt: 1,
};
const REQ: Omit<ImpersonationSelection, 'periodLabel'> = {
  programId: '1',
  shortCode: 'N-DESG',
  name: 'Design nábytku',
  faculty: 'LDF',
  year: 1,
  group: 1,
  rozvrh,
};
const ALL = new Set(['S1-A', 'S2-A', 'S2-B']);
const asked = (batch: ReturnType<typeof vi.fn>) =>
  new Set(batch.mock.calls.flatMap((c) => c[0] as string[]));
const spyBatch = () => {
  const batch = vi.fn(async () => {});
  useAppStore.setState({ fetchSuccessRateBatch: batch } as never);
  return batch;
};

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(2026, 8, 26), toFake: ['Date'] });
  await IndexedDBService.clearAll();
  useAppStore.setState(
    overlayWrite({ impersonation: null, adminRole: 'reis_admin' as const, demoMode: false })
  );
  fetchImpersonation.mockReset();
  fetchImpersonation.mockResolvedValue(RESULT);
});

describe('impersonation — fail rates for the whole plan', () => {
  it('start asks for every subject in the plan', async () => {
    const batch = spyBatch();
    await useAppStore.getState().startImpersonation(REQ);
    expect(asked(batch)).toEqual(ALL);
  });

  it('restore asks as well — a relaunch starts with no rates in memory', async () => {
    spyBatch();
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState({ impersonation: null });
    const batch = spyBatch();
    await useAppStore.getState().restoreImpersonation();
    expect(asked(batch)).toEqual(ALL);
  });
});
