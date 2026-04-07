export interface SubjectStatus {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  isEnrolled: boolean;
  isFulfilled: boolean;
  enrollmentCount: number;
  fulfillmentDate?: string;
  rawStatusText: string;
}

export interface SubjectGroup {
  name: string;
  statusDescription: string;
  subjects: SubjectStatus[];
  /** Minimum number of subjects required from this group (parsed from "min. N př."). */
  minCount?: number;
  /** Minimum total credits required from this group (parsed from "min. N kr."). */
  minCredits?: number;
}

export interface SemesterBlock {
  title: string;
  groups: SubjectGroup[];
  isWholePlanPool?: boolean;
}

export interface ZamerangSubjectRef {
  code: string;
  name: string;
}

export interface Zamerani {
  name: string;
  subjects: ZamerangSubjectRef[];
  description?: string;
}

export interface StudyPlan {
  title: string;
  isFulfilled: boolean;
  creditsAcquired: number;
  creditsRequired: number;
  blocks: SemesterBlock[];
  zameranis?: Zamerani[];
  /** Minimum number of zaměření the student must complete during the program (e.g. 2). */
  zameraniMinimum?: number;
}

export interface DualLanguageStudyPlan {
  cz: StudyPlan;
  en: StudyPlan;
}

export interface SemesterStats {
  enrolledCredits: number;
  earnedCredits: number;
  unearnedCredits: number;
  completedSubjects: number;
  gpa: number;
  gpaWithFails: number;
}

export interface StudyStats {
  currentSemester: SemesterStats;
  previousSemester: SemesterStats | null;
  totalEarnedCredits: number;
  creditsLastTwoPeriods: number;
  repeatedSubjects: number;
  registrationVouchersInitial: number;
  registrationVouchersCurrent: number;
  gpaTotal: number;
  weightedGpaTotal: number;
}

export function isDualLanguageStudyPlan(val: unknown): val is DualLanguageStudyPlan {
    return val !== null && typeof val === 'object' && 'cz' in (val as Record<string, unknown>) && 'en' in (val as Record<string, unknown>);
}
