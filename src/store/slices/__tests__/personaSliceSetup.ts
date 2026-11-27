import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import type {
  FacultyOptions,
  ImpersonationResult,
  ImpersonationSelection,
  RozvrhRef,
} from '../../../api/impersonation/types';
import type { BlockLesson } from '../../../types/schedule';

/**
 * Shared by the persona slice tests (switch, cache lifetime, races). Each test
 * file declares the same vi.mock block itself (vi.mock is hoisted per file) and
 * hands its mocks to `resetPersonaStore`.
 */
export const ROZVRH: RozvrhRef = {
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
export const variant = (programId: string, shortCode: string) => ({
  programId,
  shortCode,
  rozvrh: ROZVRH,
});
export const OPTIONS: FacultyOptions[] = [
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

export const lesson = (code: string): BlockLesson => ({
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
export const resultFor = (sel: ImpersonationSelection, code: string): ImpersonationResult => ({
  resolved: variant(sel.programId, sel.shortCode),
  plan: { cz: plan, en: plan },
  schedule: [lesson(code)],
  subjects: { version: 1, lastUpdated: 'x', data: {} },
  fetchedAt: Date.now(),
});

export const s = () => useAppStore.getState();
export const codes = () => s().schedule.data.map((l) => l.courseCode);
export const flush = () => new Promise((r) => setTimeout(r, 0));
/**
 * Lets a background refresh run to its end: a fetch, then several IndexedDB
 * round-trips (fake-indexeddb answers on later macrotasks). Two flushes were
 * enough on an idle machine and not under load.
 */
export const settle = async () => {
  for (let i = 0; i < 30; i++) await flush();
};

export interface PersonaMocks {
  fetchImpersonation: Mock;
  loadOptions: Mock;
  loadYear1Groups: Mock;
}

/** A clean admin with a real schedule of their own, and IS answering B-F-1 / B-OI-1. */
export async function resetPersonaStore({
  fetchImpersonation,
  loadOptions,
  loadYear1Groups,
}: PersonaMocks) {
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
}

/** A fetch that answers only when the test says so. */
export function gatedFetch(fetchImpersonation: Mock, code: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
    await gate;
    return resultFor(sel, code);
  });
  return () => release();
}
