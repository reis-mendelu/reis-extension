import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchImpersonation = vi.fn();
const hasAdminSession = vi.fn(async () => false);
vi.mock('../../../services/admin/hasAdminSession', () => ({
  hasAdminSession: () => hasAdminSession(),
}));
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => fetchImpersonation(...a),
}));
vi.mock('../../../api/impersonation/options', () => ({
  loadOptions: vi.fn(async () => []),
  loadYear1Groups: vi.fn(async () => [1, 2]),
}));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import { ImpersonationError } from '../../../api/impersonation/types';
import type { ImpersonationResult, ImpersonationSelection } from '../../../api/impersonation/types';
import type { BlockLesson } from '../../../types/schedule';

const lesson = (code: string): BlockLesson => ({
  id: code,
  date: '20260922',
  startTime: '09:00',
  endTime: '10:50',
  courseCode: code,
  courseName: code,
  courseId: '1',
  room: 'Q01',
  roomStructured: { name: 'Q01', id: '1' },
  isSeminar: 'false',
  isConsultation: 'false',
  isDefaultCampus: 'true',
  facultyCode: 'PEF',
  campus: 'Brno',
  teachers: [],
  studyId: '',
  periodId: '',
});
const plan = {
  title: 'B-F',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 180,
  blocks: [],
};
const RESULT: ImpersonationResult = {
  resolved: {
    programId: '1889',
    shortCode: 'B-F',
    rozvrh: {
      id: '5769',
      z: '20260921',
      k: '20261213',
      label: '',
      period: 'ZS 2026/2027',
      faculty: 'PEF',
      form: 'prezenční',
      start: '21.09.2026',
      end: '20.12.2026',
    },
  },
  plan: { cz: plan, en: plan },
  schedule: [lesson('EBC-MT')],
  subjects: { version: 1, lastUpdated: 'x', data: {} },
  fetchedAt: 1,
};
const REQ: Omit<ImpersonationSelection, 'periodLabel'> = {
  programId: '1889',
  shortCode: 'B-F',
  name: 'Finance',
  faculty: 'PEF',
  year: 1,
  group: 2,
  rozvrh: {
    id: '5769',
    z: '20260921',
    k: '20261213',
    label: '',
    period: 'ZS 2026/2027',
    faculty: 'PEF',
    form: 'prezenční',
    start: '21.09.2026',
    end: '20.12.2026',
  },
};
const codes = () => useAppStore.getState().schedule.data.map((l) => l.courseCode);

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(2026, 8, 26), toFake: ['Date'] });
  await IndexedDBService.clearAll();
  await IndexedDBService.set('schedule', 'current', [lesson('REAL-1')]);
  // overlayWrite: a previous test may have left an impersonation active, and the
  // guard would otherwise strip this reset of `schedule`.
  useAppStore.setState(
    overlayWrite({
      impersonation: null,
      impersonationError: null,
      adminRole: 'reis_admin' as const,
      demoMode: false,
      schedule: { data: [lesson('REAL-1')], status: 'success' as const },
    })
  );
  fetchImpersonation.mockReset();
  fetchImpersonation.mockResolvedValue(RESULT);
  hasAdminSession.mockResolvedValue(false);
});

describe('impersonation slice', () => {
  it('refuses unless the signed-in admin is a reis_admin', async () => {
    useAppStore.setState({ adminRole: 'association' });
    expect(await useAppStore.getState().startImpersonation(REQ)).toBe(false);
    expect(useAppStore.getState().impersonationError).toBe('notAdmin');
    expect(fetchImpersonation).not.toHaveBeenCalled();
  });

  it('applies the overlay, and real sync data arriving meanwhile cannot replace it', async () => {
    expect(await useAppStore.getState().startImpersonation(REQ)).toBe(true);
    expect(codes()).toEqual(['EBC-MT']);
    useAppStore.getState().setSchedule([lesson('REAL-2')]);
    await useAppStore.getState().fetchSchedule();
    expect(codes()).toEqual(['EBC-MT']);
    expect(useAppStore.getState().exams.data).toEqual([]);
    expect(useAppStore.getState().studyStats).toBeNull();
    expect(useAppStore.getState().impersonation?.selection.periodLabel).toBe('ZS 2026/2027');
  });

  it('names the programme version the plan came from', async () => {
    // Asked for the merged entry under B-RASZ; IS had the plan under B-RSZ.
    fetchImpersonation.mockResolvedValue({
      ...RESULT,
      resolved: { ...RESULT.resolved, programId: '1832', shortCode: 'B-RSZ' },
    });
    await useAppStore
      .getState()
      .startImpersonation({ ...REQ, programId: '3226', shortCode: 'B-RASZ' });
    expect(useAppStore.getState().impersonation?.selection).toMatchObject({
      programId: '1832',
      shortCode: 'B-RSZ',
    });
  });

  it('never writes the real stores; exit re-reads them', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    expect((await IndexedDBService.get('schedule', 'current'))!.map((l) => l.courseCode)).toEqual([
      'REAL-1',
    ]);
    await useAppStore.getState().stopImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('survives a restart: restore re-applies from IDB without calling IS', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState({ impersonation: null });
    fetchImpersonation.mockClear();
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation?.selection.shortCode).toBe('B-F');
    expect(codes()).toEqual(['EBC-MT']);
    expect(fetchImpersonation).not.toHaveBeenCalled();
  });

  it('restore drops it when there is no admin session at all (admin logout, IS logout, identity change)', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState(overlayWrite({ impersonation: null, adminRole: null }));
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('restore drops it when the account is not a reis_admin', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState(overlayWrite({ impersonation: null, adminRole: 'association' as const }));
    hasAdminSession.mockResolvedValue(true);
    await useAppStore.getState().restoreImpersonation();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('restore keeps (but does not apply) the cache when the role could not be resolved', async () => {
    // Offline boot: a stored admin session exists, the role lookup failed.
    hasAdminSession.mockResolvedValue(true);
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState(overlayWrite({ impersonation: null, adminRole: null }));
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeDefined();
  });

  it('restore drops a cache from another period and says so', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    useAppStore.setState({ impersonation: null });
    vi.setSystemTime(new Date(2027, 2, 1));
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(useAppStore.getState().impersonationError).toBe('expired');
  });

  it('adminLogout ends an active impersonation', async () => {
    await useAppStore.getState().startImpersonation(REQ);
    await useAppStore.getState().adminLogout();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
  });

  it('a failed fetch leaves the real data and reports the code', async () => {
    fetchImpersonation.mockRejectedValue(new ImpersonationError('timetable'));
    expect(await useAppStore.getState().startImpersonation(REQ)).toBe(false);
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(useAppStore.getState().impersonationError).toBe('timetable');
    expect(codes()).toEqual(['REAL-1']);
  });

  describe('fail rates for the whole plan, not just this semester', () => {
    // A first-year's plan: semester 1 is what they attend (`subjects`), semesters
    // 2+ are only in the plan. The study plan screen shows a fail rate on every
    // row, and the overlay guard keeps `fetchStudyPlan` — the plan-wide batch —
    // from running, so this slice is the only thing that can ask for them.
    // Measured on a Pixel: only semester 1 had chips; each later row had to be
    // tapped open before its rate appeared.
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
    const planWith = { ...plan, blocks: [block('1', ['S1-A']), block('2', ['S2-A', 'S2-B'])] };
    const WITH_PLAN: ImpersonationResult = {
      ...RESULT,
      plan: { cz: planWith, en: planWith },
      subjects: { version: 1, lastUpdated: 'x', data: { 'S1-A': {} as never } },
    };
    const asked = (batch: ReturnType<typeof vi.fn>) =>
      new Set(batch.mock.calls.flatMap((c) => c[0] as string[]));

    it('start asks for every subject in the plan', async () => {
      fetchImpersonation.mockResolvedValue(WITH_PLAN);
      const batch = vi.fn(async () => {});
      useAppStore.setState({ fetchSuccessRateBatch: batch } as never);
      await useAppStore.getState().startImpersonation(REQ);
      expect(asked(batch)).toEqual(new Set(['S1-A', 'S2-A', 'S2-B']));
    });

    it('restore asks as well — a relaunch starts with no rates in memory', async () => {
      fetchImpersonation.mockResolvedValue(WITH_PLAN);
      await useAppStore.getState().startImpersonation(REQ);
      useAppStore.setState({ impersonation: null });
      const batch = vi.fn(async () => {});
      useAppStore.setState({ fetchSuccessRateBatch: batch } as never);
      await useAppStore.getState().restoreImpersonation();
      expect(asked(batch)).toEqual(new Set(['S1-A', 'S2-A', 'S2-B']));
    });
  });
});
