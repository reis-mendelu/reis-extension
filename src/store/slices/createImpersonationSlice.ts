import type { AppSlice } from '../types';
import {
  ImpersonationError,
  type FacultyOptions,
  type ImpersonationErrorCode,
  type ImpersonationResult,
  type ImpersonationSelection,
  type ProgrammeOption,
} from '../../api/impersonation/types';
import { fetchImpersonation } from '../../api/impersonation/fetchImpersonation';
import { loadOptions, loadYear1Groups } from '../../api/impersonation/options';
import { currentPeriod, periodLabel } from '../../api/impersonation/intake';
import { overlayWrite } from '../overlay/overlayGuard';
import { blankOverlayState } from '../overlay/overlayState';
import { readRememberedViewer } from './context/rememberedViewer';
import { loadImpersonation, clearImpersonation } from './impersonation/impersonationStorage';
import { clearPersonaCache, hasPersonaCache } from './impersonation/personaCache';
import {
  applyImpersonation,
  currentImpersonationEpoch,
  nextImpersonationEpoch,
} from './impersonation/applyImpersonation';
import { hasAdminSession } from '../../services/admin/hasAdminSession';
import { logError } from '../../utils/reportError';

export interface ActiveImpersonation {
  selection: ImpersonationSelection;
  result: ImpersonationResult;
}

export interface ImpersonationSlice {
  impersonation: ActiveImpersonation | null;
  impersonationPickerOpen: boolean;
  impersonationOptions: FacultyOptions[] | null;
  impersonationOptionsStatus: 'idle' | 'loading' | 'error';
  impersonationGroups: Record<string, number[] | 'loading' | 'error'>;
  impersonationStarting: boolean;
  impersonationError: ImpersonationErrorCode | null;
  openImpersonationPicker: () => void;
  closeImpersonationPicker: () => void;
  loadImpersonationOptions: () => Promise<void>;
  loadImpersonationGroups: (p: ProgrammeOption) => Promise<void>;
  startImpersonation: (req: Omit<ImpersonationSelection, 'periodLabel'>) => Promise<boolean>;
  stopImpersonation: () => Promise<void>;
  restoreImpersonation: () => Promise<void>;
}

const codeOf = (e: unknown): ImpersonationErrorCode =>
  e instanceof ImpersonationError ? e.code : 'timetable';

/**
 * A boot with no admin session ends the cached personas too, even with none
 * active: they belong to the admin session (design 2026-11-27 §3). The admin
 * session is looked up only when a persona is cached, so a student's boot asks
 * nothing.
 */
async function dropPersonasWithoutAdmin(role: string | null): Promise<void> {
  if (role === 'reis_admin' || !(await hasPersonaCache().catch(() => false))) return;
  if (role !== null || !(await hasAdminSession())) await clearPersonaCache().catch(() => {});
}

/**
 * "View as a student" for reIS admins: another programme's plan, subjects and
 * timetable, fetched live from IS through the admin's own session and laid over
 * the store, and that student's faculty, programme and Erasmus status in place
 * of the admin's (design 2026-11-27 §2). The overlay guard keeps every other writer off those keys while
 * this is active; the admin's real data keeps syncing into IndexedDB underneath.
 */
export const createImpersonationSlice: AppSlice<ImpersonationSlice> = (set, get) => ({
  impersonation: null,
  impersonationPickerOpen: false,
  impersonationOptions: null,
  impersonationOptionsStatus: 'idle',
  impersonationGroups: {},
  impersonationStarting: false,
  impersonationError: null,

  openImpersonationPicker: () => {
    set({ impersonationPickerOpen: true });
    void get().loadImpersonationOptions();
  },
  // Closing it while a one-off starts cancels that one-off: it must not land later.
  closeImpersonationPicker: () => {
    if (get().impersonationStarting) nextImpersonationEpoch();
    set({ impersonationPickerOpen: false, impersonationStarting: false });
  },

  // Called from the entry's click handler on both trees — never from an effect.
  loadImpersonationOptions: async () => {
    if (get().impersonationOptions || get().impersonationOptionsStatus === 'loading') return;
    set({ impersonationOptionsStatus: 'loading' });
    try {
      set({ impersonationOptions: await loadOptions(), impersonationOptionsStatus: 'idle' });
    } catch (e) {
      logError('Impersonation.loadOptions', e);
      set({ impersonationOptionsStatus: 'error' });
    }
  },

  loadImpersonationGroups: async (p) => {
    if (Array.isArray(get().impersonationGroups[p.programId])) return;
    const put = (v: number[] | 'loading' | 'error') =>
      set((s) => ({ impersonationGroups: { ...s.impersonationGroups, [p.programId]: v } }));
    put('loading');
    try {
      put(await loadYear1Groups(p));
    } catch (e) {
      logError('Impersonation.loadGroups', e);
      put('error');
    }
  },

  startImpersonation: async (req) => {
    if (get().adminRole !== 'reis_admin' || get().demoMode) {
      set({ impersonationError: 'notAdmin' });
      return false;
    }
    const epoch = nextImpersonationEpoch();
    set({ impersonationStarting: true, impersonationError: null });
    const selection: ImpersonationSelection = {
      ...req,
      periodLabel: periodLabel(currentPeriod(new Date())),
    };
    try {
      const result = await fetchImpersonation(selection);
      // The programme version that actually had the plan (B-RSZ vs B-RASZ): the
      // banner names the code the timetable came from. Not applied once Já, a
      // persona or an admin logout has taken over (applyImpersonation's epoch).
      const applied =
        get().adminRole === 'reis_admin' &&
        (await applyImpersonation(
          set,
          get,
          { selection: { ...selection, ...result.resolved }, result },
          { epoch }
        ));
      if (!applied) set({ impersonationStarting: false });
      return applied;
    } catch (e) {
      logError('Impersonation.start', e, { year: req.year });
      set({ impersonationStarting: false, impersonationError: codeOf(e) });
      return false;
    }
  },

  // The admin's own identity comes back from the record loadContext kept
  // writing underneath (none yet: blank, and loadContext asks IS).
  stopImpersonation: async () => {
    nextImpersonationEpoch();
    await clearImpersonation().catch((e) => logError('Impersonation.clear', e));
    const own = await readRememberedViewer().catch(() => null);
    set(
      overlayWrite({
        impersonation: null,
        ...blankOverlayState(),
        ...(own ?? { userFaculty: null, userProgramme: null, isErasmus: false }),
      })
    );
    const s = get();
    await Promise.all([
      s.loadContext(),
      s.fetchSchedule(),
      s.fetchStudyPlan(),
      s.fetchSubjects(),
      s.fetchExams(),
      s.fetchStudyStats(),
      s.fetchStudyComparison(),
      s.loadGradeHistory(),
      s.fetchCvicneTests(),
      s.fetchOdevzdavarny(),
    ]);
  },

  // Boot, after loadAdminSession settles. Admin logout, IS logout and a changed
  // student all leave NO admin session behind — that, or a non-admin role,
  // clears it. A session whose role lookup failed (offline) keeps it for the
  // next boot without applying it.
  restoreImpersonation: async () => {
    // Anything the admin does while this reads IndexedDB (Já, a persona) wins.
    const epoch = currentImpersonationEpoch();
    const saved = await loadImpersonation().catch(() => null);
    if (!saved) return dropPersonasWithoutAdmin(get().adminRole);
    const drop = async (why?: 'expired') => {
      await clearImpersonation().catch(() => {});
      if (why) set({ impersonationError: why });
      // No admin session (or not a reis_admin): the persona cache goes too.
      else await clearPersonaCache().catch(() => {});
    };
    if (saved.selection.periodLabel !== periodLabel(currentPeriod(new Date()))) {
      await drop('expired');
      return dropPersonasWithoutAdmin(get().adminRole);
    }
    const role = get().adminRole;
    if (role === 'reis_admin') {
      await applyImpersonation(set, get, saved, { epoch });
      return;
    }
    if (role !== null || !(await hasAdminSession())) return drop();
  },
});
