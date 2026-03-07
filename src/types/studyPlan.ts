export interface SubjectStatus {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  isEnrolled: boolean;
  isFulfilled: boolean;
  fulfillmentDate?: string;
  rawStatusText: string;
}

export interface SubjectGroup {
  name: string;
  statusDescription: string;
  subjects: SubjectStatus[];
}

export interface SemesterBlock {
  title: string;
  groups: SubjectGroup[];
}

export interface StudyPlan {
  title: string;
  isFulfilled: boolean;
  creditsAcquired: number;
  creditsRequired: number;
  blocks: SemesterBlock[];
}

export interface DualLanguageStudyPlan {
  cz: StudyPlan;
  en: StudyPlan;
}

export function isDualLanguageStudyPlan(val: unknown): val is DualLanguageStudyPlan {
    return val !== null && typeof val === 'object' && 'cz' in (val as Record<string, unknown>) && 'en' in (val as Record<string, unknown>);
}
