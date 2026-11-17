import type { DualLanguageStudyPlan } from '@/types/studyPlan';
import { selectEnrolledNow } from '@/utils/mobile/enrolledSubjects';

export interface StudyPlanCounts {
  /** 'loading' (IndexedDB not read yet), 'none' (no plan held) or 'success'. */
  studyPlan?: string;
  /** Semester blocks. A real plan has one per semester; 1 is the signature of
   *  a heading the parser missed (5.6.0 on the new IS markup, suggestion 46). */
  planBlocks?: number;
  /** Subjects across all blocks. 0 means Předměty has no plan to draw and
   *  falls back to the subject list (exchange students). */
  planSubjects?: number;
  /** What the phone's Předměty card lists as this semester's subjects. */
  planEnrolledNow?: number;
}

/**
 * The study plan as Předměty sees it, on both trees: the plan in the app's
 * language, which is what `useStudyPlan` hands the screen. Counts only, never
 * which subject. Runs inside Send, so a plan of an unexpected shape drops these
 * fields, never the report.
 */
export function studyPlanCounts(s: {
  studyPlanDual?: DualLanguageStudyPlan | null;
  studyPlanLoaded?: boolean;
  language: 'cz' | 'en';
}): StudyPlanCounts {
  try {
    const plan = s.studyPlanDual?.[s.language === 'en' ? 'en' : 'cz'] ?? null;
    if (!plan) {
      return {
        studyPlan: s.studyPlanLoaded === false ? 'loading' : 'none',
        planBlocks: 0,
        planSubjects: 0,
        planEnrolledNow: 0,
      };
    }
    return {
      studyPlan: 'success',
      planBlocks: plan.blocks.length,
      planSubjects: plan.blocks.reduce(
        (n, b) => n + b.groups.reduce((m, g) => m + g.subjects.length, 0),
        0
      ),
      planEnrolledNow: selectEnrolledNow(plan).length,
    };
  } catch {
    return {};
  }
}
