import type { BlockLesson } from '../../types/schedule';
import type { DualLanguageStudyPlan } from '../../types/studyPlan';
import type { SubjectsData } from '../../types/documents';

/** One timetable (rozvrh) of the timetable app, with the z/k/f triple IS wants back. */
export interface RozvrhRef {
  id: string;
  z: string;
  k: string;
  label: string;
  period: string;
  /** Pracoviště short name, e.g. 'PEF'. */
  faculty: string;
  /** 'prezenční' | 'kombinovaná' */
  form: string;
  /** Validity start/end as IS prints them, DD.MM.YYYY — also the konani_od/do range. */
  start: string;
  end: string;
}

/** One IS programme id. A programme re-accredited for a new intake gets a new id. */
export interface ProgrammeVariant {
  programId: string;
  shortCode: string;
  rozvrh: RozvrhRef;
}

/**
 * One picker entry. `variants` are the IS versions of the same programme at one
 * faculty — e.g. B-RSZ (intakes up to 2025) and B-RASZ (from 2026), both
 * "Realizace a správa zeleně". The top-level id is the first variant's.
 */
export interface ProgrammeOption extends ProgrammeVariant {
  name: string;
  faculty: string;
  years: number[];
  variants: ProgrammeVariant[];
}

export interface FacultyOptions {
  faculty: string;
  programmes: ProgrammeOption[];
}

export interface ImpersonationSelection {
  programId: string;
  shortCode: string;
  name: string;
  faculty: string;
  year: number;
  /** Year-1 study group (IS `skupina`); null = all groups / no groups. */
  group: number | null;
  rozvrh: RozvrhRef;
  /** The IS versions to try, in order; the first with a plan for the intake wins. */
  variants?: ProgrammeVariant[];
  /** The period this was fetched for, e.g. 'ZS 2026/2027'. A mismatch at boot ends it. */
  periodLabel: string;
}

export interface ImpersonationResult {
  /** The programme version the plan and timetable came from. */
  resolved: ProgrammeVariant;
  plan: DualLanguageStudyPlan;
  schedule: BlockLesson[];
  subjects: SubjectsData;
  fetchedAt: number;
}

export type ImpersonationErrorCode =
  'options' | 'timetable' | 'noPlan' | 'noSemester' | 'expired' | 'notAdmin';

export class ImpersonationError extends Error {
  readonly code: ImpersonationErrorCode;
  constructor(code: ImpersonationErrorCode) {
    super(`impersonation:${code}`);
    this.code = code;
  }
}
