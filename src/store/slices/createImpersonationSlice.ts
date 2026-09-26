import type { AppSlice } from '../types';
import {
  ImpersonationError,
  type FacultyOptions,
  type ImpersonationErrorCode,
  type ImpersonationResult,
  type ImpersonationSelection,
  type ProgrammeOption,
} from '../../api/impersonation/types';
import {
  fetchImpersonation,
  loadOptions,
  loadYear1Groups,
} from '../../api/impersonation/fetchImpersonation';
import { currentPeriod, periodLabel } from '../../api/impersonation/intake';
import { overlayWrite } from '../overlay/overlayGuard';
import { overlayState, blankOverlayState } from '../overlay/overlayState';
import {
  saveImpersonation,
  loadImpersonation,
  clearImpersonation,
} from './impersonation/impersonationStorage';
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
 * "View as a student" for reIS admins: another programme's plan, subjects and
 * timetable, fetched live from IS through the admin's own session and laid over
 * the store. The overlay guard keeps every other writer off those keys while
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
  closeImpersonationPicker: () => set({ impersonationPickerOpen: false }),

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
    set({ impersonationStarting: true, impersonationError: null });
    const selection: ImpersonationSelection = {
      ...req,
      periodLabel: periodLabel(currentPeriod(new Date())),
    };
    try {
      const result = await fetchImpersonation(selection);
      const active = { selection, result };
      await saveImpersonation(active);
      set(
        overlayWrite({
          impersonation: active,
          ...overlayState(result),
          impersonationStarting: false,
          impersonationPickerOpen: false,
        })
      );
      const codes = Object.keys(result.subjects.data);
      if (codes.length)
        void get()
          .fetchSuccessRateBatch(codes)
          .catch(() => {});
      return true;
    } catch (e) {
      logError('Impersonation.start', e, { year: req.year });
      set({ impersonationStarting: false, impersonationError: codeOf(e) });
      return false;
    }
  },

  stopImpersonation: async () => {
    await clearImpersonation().catch((e) => logError('Impersonation.clear', e));
    set(overlayWrite({ impersonation: null, ...blankOverlayState() }));
    const s = get();
    await Promise.all([
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
    const saved = await loadImpersonation().catch(() => null);
    if (!saved) return;
    const drop = async (why?: 'expired') => {
      await clearImpersonation().catch(() => {});
      if (why) set({ impersonationError: why });
    };
    if (saved.selection.periodLabel !== periodLabel(currentPeriod(new Date())))
      return drop('expired');
    const role = get().adminRole;
    if (role === 'reis_admin') {
      set(overlayWrite({ impersonation: saved, ...overlayState(saved.result) }));
      return;
    }
    if (role !== null || !(await hasAdminSession())) return drop();
  },
});
