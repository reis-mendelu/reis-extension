import type { AppSlice, StudyPlanSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { isDualLanguageStudyPlan } from '../../types/studyPlan';
import type { StudyStats, StudyComparison } from '../../types/studyPlan';
import type { GradeHistory } from '../../types/documents';

export const createStudyPlanSlice: AppSlice<StudyPlanSlice> = (set, get) => ({
  studyPlanDual: null,
  studyPlanLoaded: false,
  studyStats: null,
  studyComparison: null,
  gradeHistory: null,
  fetchStudyPlan: async () => {
    try {
      const stored = await IndexedDBService.get('study_plan', 'current');
      if (stored && isDualLanguageStudyPlan(stored)) {
        set({ studyPlanDual: stored, studyPlanLoaded: true });
        // The failure rates for every subject in the plan, fetched HERE
        // rather than from a component effect. `usePlanSuccessRates` used
        // to do it from a `useEffect` in SubjectsScreen, which made
        // mounting a component start a fetch — the one thing the
        // project's rules rule out ("NO useEffect for data fetching"),
        // flagged twice in review on this PR.
        //
        // This is the only place `studyPlanDual` is ever written, which
        // is what makes it the honest trigger: the rates are wanted
        // exactly when there is a plan to want them for. Codes are the
        // same in both languages, so either side will do.
        //
        // Not awaited, and its rejection swallowed: the rates are a
        // chip on a row, and the plan is the screen. A CDN outage must
        // not cost the student their subject list.
        const codes = stored.cz.blocks.flatMap((b) =>
          b.groups.flatMap((g) => g.subjects.map((sub) => sub.code))
        );
        if (codes.length > 0)
          void get()
            .fetchSuccessRateBatch(codes)
            .catch(() => {});
      } else {
        set({ studyPlanLoaded: true });
      }
    } catch {
      set({ studyPlanLoaded: true });
    }
  },
  fetchStudyStats: async () => {
    try {
      const stored = (await IndexedDBService.get('meta', 'study_stats')) as StudyStats | null;
      if (stored) set({ studyStats: stored });
    } catch {
      // Ignore if stats fail to load from IDB
    }
  },
  setStudyStats: (stats) => set({ studyStats: stats }),
  fetchStudyComparison: async () => {
    try {
      const stored = (await IndexedDBService.get(
        'meta',
        'study_comparison'
      )) as StudyComparison | null;
      if (stored) set({ studyComparison: stored });
    } catch {
      // Ignore if comparison fails to load from IDB
    }
  },
  setStudyComparison: (c) => set({ studyComparison: c }),
  loadGradeHistory: async () => {
    try {
      const stored = (await IndexedDBService.get('grade_history', 'all')) as GradeHistory | null;
      if (stored) set({ gradeHistory: stored });
    } catch {
      // Ignore if grades fail to load from IDB
    }
  },
  setGradeHistory: (g) => set({ gradeHistory: g }),
});
