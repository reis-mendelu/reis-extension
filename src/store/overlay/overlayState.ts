import type { ImpersonationResult } from '../../api/impersonation/types';

/** What the screens show while impersonating: the fetched three, the rest empty. */
export function overlayState(result: ImpersonationResult) {
  return {
    schedule: { data: result.schedule, status: 'success' as const },
    studyPlanDual: result.plan,
    subjects: result.subjects,
    ...blankRest(),
  };
}

/** The protected keys reset to "nothing loaded" — the first step of exit. */
export function blankOverlayState() {
  return {
    schedule: { data: [], status: 'loading' as const },
    studyPlanDual: null,
    subjects: null,
    ...blankRest(),
  };
}

function blankRest() {
  return {
    exams: { data: [], status: 'success' as const, error: null },
    studyStats: null,
    studyComparison: null,
    gradeHistory: null,
    cvicneTests: [],
    odevzdavarny: [],
  };
}
