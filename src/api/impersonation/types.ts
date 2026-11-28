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

/** One course of a rozvrh's course select: "EBA-MAR - Marketing 1 v AJ". */
export interface CourseOption {
  code: string;
  name: string;
  /** This period's IS subject id, what the timetable's `predmet` takes. */
  predmetId: string;
  rozvrh: RozvrhRef;
}

export interface FacultyOptions {
  faculty: string;
  programmes: ProgrammeOption[];
  /**
   * Every course of the faculty's prezenční timetables, kept from the same
   * criteria forms the programmes come from: the Erasmus persona resolves its
   * pinned codes here (design 2026-11-27 §4). Absent in older test data.
   */
  courses?: CourseOption[];
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
  /**
   * An exchange student: the persona's programme is Z-EXC and `isErasmus` is
   * true (store/overlay/identityOverlay). Today's picker never sets it; the
   * Erasmus persona does (design 2026-11-27, step C). Absent = not Erasmus,
   * which is also what a selection saved by an older build reads as. Set, the
   * fetch asks for `courses` instead of a plan (fetchExchange).
   */
  erasmus?: boolean;
  /**
   * Erasmus only: the pinned courses that resolved, with this period's ids and
   * the timetable each was listed in (absent = the selection's `rozvrh`).
   */
  courses?: { code: string; predmetId: string; rozvrh?: RozvrhRef }[];
  /**
   * Set when this came from the one-tap persona list (`features/personas.ts`):
   * which one, so the list can check it and the banner can name it. Absent for
   * a one-off from the picker, and in a selection an older build saved.
   */
  personaId?: string;
}

export interface ImpersonationResult {
  /** The programme version the plan and timetable came from. */
  resolved: ProgrammeVariant;
  /** Null for the Erasmus persona: IS's catalogue has no plan for Z-EXC. */
  plan: DualLanguageStudyPlan | null;
  schedule: BlockLesson[];
  subjects: SubjectsData;
  fetchedAt: number;
}

export type ImpersonationErrorCode =
  | 'options'
  | 'timetable'
  | 'noPlan'
  | 'noSemester'
  | 'expired'
  | 'notAdmin'
  /** IndexedDB refused to save the view: nothing was applied. */
  | 'storage';

export class ImpersonationError extends Error {
  readonly code: ImpersonationErrorCode;
  constructor(code: ImpersonationErrorCode) {
    super(`impersonation:${code}`);
    this.code = code;
  }
}
