import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchImpersonation = vi.fn();
const loadOptions = vi.fn();
const loadYear1Groups = vi.fn();
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => fetchImpersonation(...a),
}));
vi.mock('../../../api/impersonation/options', () => ({
  loadOptions: (...a: unknown[]) => loadOptions(...a),
  loadYear1Groups: (...a: unknown[]) => loadYear1Groups(...a),
}));
vi.mock('../../../services/admin/hasAdminSession', () => ({ hasAdminSession: async () => false }));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
}));
// Exit re-runs loadContext: no IS here, so the admin's own record is "none".
vi.mock('../../../utils/userParams', async (orig) => ({
  ...(await orig<typeof import('../../../utils/userParams')>()),
  getUserParams: async () => null,
  isIdentityConfirmed: () => true,
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import { ImpersonationError } from '../../../api/impersonation/types';
import type {
  FacultyOptions,
  ImpersonationResult,
  ImpersonationSelection,
  RozvrhRef,
} from '../../../api/impersonation/types';
import type { BlockLesson } from '../../../types/schedule';

const ROZVRH: RozvrhRef = {
  id: '5769',
  z: '20260921',
  k: '20261213',
  label: '',
  period: 'ZS 2026/2027',
  faculty: 'PEF',
  form: 'prezenční',
  start: '21.09.2026',
  end: '20.12.2026',
};
const variant = (programId: string, shortCode: string) => ({
  programId,
  shortCode,
  rozvrh: ROZVRH,
});
const OPTIONS: FacultyOptions[] = [
  {
    faculty: 'PEF',
    programmes: [
      {
        ...variant('1', 'B-OI'),
        name: 'Otevřená informatika',
        faculty: 'PEF',
        years: [1],
        variants: [variant('1', 'B-OI')],
      },
      {
        ...variant('2', 'B-F'),
        name: 'Finance',
        faculty: 'PEF',
        years: [1],
        variants: [variant('2', 'B-F')],
      },
    ],
  },
];

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
  title: 'x',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 180,
  blocks: [],
};
const resultFor = (sel: ImpersonationSelection, code: string): ImpersonationResult => ({
  resolved: variant(sel.programId, sel.shortCode),
  plan: { cz: plan, en: plan },
  schedule: [lesson(code)],
  subjects: { version: 1, lastUpdated: 'x', data: {} },
  fetchedAt: Date.now(),
});

const s = () => useAppStore.getState();
const codes = () => s().schedule.data.map((l) => l.courseCode);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(2026, 8, 26, 12), toFake: ['Date'] });
  await IndexedDBService.clearAll();
  await IndexedDBService.set('schedule', 'current', [lesson('REAL-1')]);
  useAppStore.setState(
    overlayWrite({
      impersonation: null,
      impersonationOptions: null,
      impersonationOptionsStatus: 'idle' as const,
      personaRows: {},
      adminRole: 'reis_admin' as const,
      adminSession: {} as never,
      demoMode: false,
      schedule: { data: [lesson('REAL-1')], status: 'success' as const },
    })
  );
  fetchImpersonation.mockReset();
  fetchImpersonation.mockImplementation(async (sel: ImpersonationSelection) =>
    resultFor(sel, `${sel.shortCode}-1`)
  );
  loadOptions.mockReset();
  loadOptions.mockResolvedValue(OPTIONS);
  loadYear1Groups.mockReset();
  loadYear1Groups.mockResolvedValue([4, 7]);
});

describe('persona switch', () => {
  it('a first switch fetches with the first IS group, applies, caches and survives restart', async () => {
    expect(await s().switchToPersona('finance')).toBe(true);
    expect(fetchImpersonation).toHaveBeenCalledOnce();
    expect(fetchImpersonation.mock.calls[0]![0]).toMatchObject({ shortCode: 'B-F', group: 4 });
    expect(codes()).toEqual(['B-F-1']);
    expect(s().impersonation?.selection.personaId).toBe('finance');
    expect(s().userProgramme).toBe('B-F');
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeDefined();
    expect(s().personaRows.finance).toBeUndefined();

    useAppStore.setState(overlayWrite({ impersonation: null }));
    await s().restoreImpersonation();
    expect(s().impersonation?.selection.personaId).toBe('finance');
  });

  it('a cached switch applies with no fetch at all', async () => {
    await s().switchToPersona('finance');
    await s().switchToPersona('it');
    fetchImpersonation.mockClear();
    loadOptions.mockClear();
    loadYear1Groups.mockClear();
    expect(await s().switchToPersona('finance')).toBe(true);
    expect(codes()).toEqual(['B-F-1']);
    expect(fetchImpersonation).not.toHaveBeenCalled();
    expect(loadOptions).not.toHaveBeenCalled();
    expect(loadYear1Groups).not.toHaveBeenCalled();
  });

  it('older than 24 h: applies the cache, then exactly one background fetch re-applies it', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    vi.setSystemTime(new Date(2026, 8, 27, 13));
    fetchImpersonation.mockClear();
    fetchImpersonation.mockImplementation(async (sel: ImpersonationSelection) =>
      resultFor(sel, 'B-F-2')
    );
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
      await gate;
      return resultFor(sel, 'B-F-2');
    });

    expect(await s().switchToPersona('finance')).toBe(true);
    expect(codes()).toEqual(['B-F-1']); // the cache, at once
    await s().switchToPersona('finance'); // a second tap while the refresh runs
    release();
    await flush();
    await flush();
    expect(fetchImpersonation).toHaveBeenCalledOnce();
    expect(codes()).toEqual(['B-F-2']);
    const saved = (await IndexedDBService.get('meta', 'persona:finance')) as {
      result: ImpersonationResult;
    };
    expect(saved.result.schedule[0]!.courseCode).toBe('B-F-2');
  });

  it('a background refresh does not re-apply once the admin moved on', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
      await gate;
      return resultFor(sel, 'B-F-2');
    });
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    release();
    await flush();
    await flush();
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
  });

  it('a failed fetch keeps the current identity and marks only that row', async () => {
    await s().switchToPersona('it');
    fetchImpersonation.mockRejectedValueOnce(new ImpersonationError('timetable'));
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(s().impersonation?.selection.personaId).toBe('it');
    expect(codes()).toEqual(['B-OI-1']);
    expect(s().userProgramme).toBe('B-OI');
    expect(s().personaRows).toEqual({ finance: 'timetable' });
    expect(s().impersonationError).toBeNull();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('an unresolved code fails its row without fetching', async () => {
    loadOptions.mockResolvedValue([]);
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(s().personaRows.finance).toBe('noPlan');
    expect(fetchImpersonation).not.toHaveBeenCalled();
  });

  it('a fetch that lands after "Já" is cached but not applied', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
      await gate;
      return resultFor(sel, 'B-F-1');
    });
    const pending = s().switchToPersona('finance');
    await flush();
    expect(s().personaRows.finance).toBe('loading');
    await s().stopImpersonation();
    release();
    expect(await pending).toBe(false);
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeDefined();
  });

  it('is for reis_admin only', async () => {
    useAppStore.setState({ adminRole: 'association' });
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(fetchImpersonation).not.toHaveBeenCalled();
    expect(s().impersonation).toBeNull();
  });

  it('drops a cached persona from another period and fetches again', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    vi.setSystemTime(new Date(2027, 2, 1));
    fetchImpersonation.mockClear();
    await s().switchToPersona('finance');
    expect(fetchImpersonation).toHaveBeenCalledOnce();
  });
});

describe('persona cache lifetime', () => {
  it('"Já" exits and keeps the cache', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeDefined();
  });

  it('admin logout clears every persona, active or not', async () => {
    await s().switchToPersona('finance');
    await s().switchToPersona('it');
    await s().stopImpersonation();
    await s().adminLogout();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
    expect(await IndexedDBService.get('meta', 'persona:it')).toBeUndefined();
  });

  it('IS logout and an identity change (clearAll) take the persona cache with them', async () => {
    await s().switchToPersona('finance');
    await IndexedDBService.clearAll();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a restore that finds no admin session clears the persona cache too', async () => {
    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null, adminRole: null }));
    await s().restoreImpersonation();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a boot with no admin session clears the persona cache even when no persona was active', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    useAppStore.setState(overlayWrite({ adminRole: null }));
    await s().restoreImpersonation();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });
});

/** A fetch that answers only when the test says so. */
function gatedFetch(code: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
    await gate;
    return resultFor(sel, code);
  });
  return () => release();
}

describe('persona races (review 2026-11-27)', () => {
  it('Já cancels a first fetch while nothing is active yet: cached, not applied', async () => {
    const release = gatedFetch('B-F-1');
    const pending = s().switchToPersona('finance');
    await flush();
    s().cancelPersonaSwitch();
    expect(s().personaRows.finance).toBeUndefined();
    release();
    expect(await pending).toBe(false);
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
  });

  it('admin logout during a fetch: nothing applied, nothing cached', async () => {
    const release = gatedFetch('B-F-1');
    const pending = s().switchToPersona('finance');
    await flush();
    await s().adminLogout();
    release();
    expect(await pending).toBe(false);
    await flush();
    expect(s().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a refresh landing while Já is on its way out does not bring the persona back', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    const release = gatedFetch('B-F-2');
    await s().switchToPersona('finance');
    const leaving = s().stopImpersonation();
    release();
    await leaving;
    await flush();
    await flush();
    expect(s().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('a refresh leaves the picker alone (open drawer, a one-off starting)', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    const release = gatedFetch('B-F-2');
    await s().switchToPersona('finance');
    useAppStore.setState({ impersonationPickerOpen: true });
    release();
    await flush();
    await flush();
    expect(codes()).toEqual(['B-F-2']);
    expect(s().impersonationPickerOpen).toBe(true);
  });

  it('an options failure says options, not timetable', async () => {
    loadOptions.mockRejectedValueOnce(new Error('network'));
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(s().personaRows.finance).toBe('options');
  });
});
