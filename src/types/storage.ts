import { z } from 'zod';
import type { SyllabusRequirements, DocumentNote } from '../types/documents';
import { ExamSubjectSchema } from './schemas/exams.schema';
import { BlockLessonSchema } from './schemas/schedule.schema';
import { SubjectsDataSchema } from './schemas/subjects.schema';
import { FilesSchema } from './schemas/files.schema';
import { SuccessRatesSchema } from './schemas/successRates.schema';
import { MetaSchema } from './schemas/meta.schema';
import { ClassmatesSchema } from './schemas/classmates.schema';
import { GradeHistorySchema } from './schemas/gradeHistory.schema';
import { StudyPlanOrDualLanguageSchema } from './schemas/studyPlan.schema';
import { CvicneTestsSchema } from './schemas/cvicneTests.schema';
import { OdevzdavarnySchema } from './schemas/odevzdavarny.schema';
import { ErasmusCountryDataSchema } from './schemas/erasmus.schema';
import type { CalendarCustomEvent } from '../types/calendarTypes';
import type { IskamData } from './iskam';
import type { SubjectZaznamnik } from './zaznamnik';

// --- Base Types using Zod ---

export const SyllabusRequirementsSchema = z.custom<SyllabusRequirements>();
export const CalendarCustomEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  room: z.string().optional(),
});
export type { CalendarCustomEvent };
export const CalendarCustomEventsSchema = z.array(CalendarCustomEventSchema);

export const HiddenItemsSchema = z.object({
  courses: z.array(
    z.object({
      courseCode: z.string(),
      courseName: z.string(),
      type: z.enum(['lecture', 'seminar', 'all']).optional(),
    })
  ),
  events: z.array(
    z.object({
      id: z.string(),
      courseCode: z.string(),
      courseName: z.string(),
      date: z.string(),
    })
  ),
});
// --- Storage Value Schemas ---

// 'assessments' store - Legacy, kept for backward compatibility
export const AssessmentsSchema = z.array(z.unknown());

// 'syllabuses' store - can be legacy single-language or dual-language object
export const SyllabusSchema = z.union([
  SyllabusRequirementsSchema,
  z.object({
    cz: SyllabusRequirementsSchema,
    en: SyllabusRequirementsSchema,
  }),
]);

// 'exams' store - Array of ExamSubject
export const ExamsSchema = z.array(ExamSubjectSchema);

// 'schedule' store - Array of BlockLesson
export const ScheduleSchema = z.array(BlockLessonSchema);

// 'subjects' store - SubjectsData
export const SubjectsSchema = SubjectsDataSchema;

// 'document_notes' store - DocumentNote
export const DocumentNoteSchema = z.custom<DocumentNote>();

// 'note_images' store - normalized image blobs, keyed by content hash
export const NoteImageSchema = z.object({
  hash: z.string(),
  // Blob is passed through without a runtime instanceof check — IndexedDB
  // round-trips it natively, and a strict check is brittle across structured-
  // clone realms (matches how ParsedFile/SubjectsData are handled here).
  blob: z.custom<Blob>(),
  mime: z.string(),
  w: z.number(),
  h: z.number(),
  createdAt: z.number(),
});

// 'iskam' store - WebISKAM dashboard snapshot (konta + ubytovani + freshness)
export const IskamDataSchema = z.object({
  konta: z.array(
    z.object({
      name: z.string(),
      nameCs: z.string().optional(),
      nameEn: z.string().optional(),
      balance: z.number(),
      balanceText: z.string(),
      topUpHref: z.string().nullable(),
      transactionsHref: z.string().nullable(),
    })
  ),
  ubytovani: z.array(
    z.object({
      dorm: z.string(),
      block: z.string(),
      room: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      status: z.string(),
      contractHref: z.string().nullable(),
    })
  ),
  profile: z
    .object({
      fullName: z.string(),
      email: z.string(),
    })
    .optional(),
  reservations: z.array(
    z.object({
      facility: z.string(),
      room: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      price: z.string().optional(),
    })
  ),
  pendingPayments: z.array(
    z.object({
      dueDate: z.string(),
      description: z.string(),
      amount: z.string(),
    })
  ),
  foodTransactions: z.array(
    z.object({
      datetime: z.string(),
      settledDate: z.string(),
      type: z.string(),
      description: z.string(),
      topUp: z.number().nullable(),
      payment: z.number().nullable(),
      balance: z.number(),
    })
  ),
  lastTopUp: z.number().nullable(),
  syncedAt: z.number(),
}) as z.ZodType<IskamData>;

// 'zaznamnik' store - PH + VT assessment data per subject (nullable on parse failure)
const PhArchSchema = z.object({
  name: z.string(),
  empty: z.boolean(),
  columns: z.array(z.string()),
  values: z.array(z.string()),
});
const PhSectionSchema = z.object({
  label: z.string(),
  arches: z.array(PhArchSchema),
});
const SubjectPhSchema = z.object({
  sections: z.array(PhSectionSchema),
  fetchedAt: z.number(),
});
const VtTestAttemptSchema = z.object({
  name: z.string(),
  score: z.number(),
  maxScore: z.number(),
  successPct: z.number(),
  submittedAt: z.string(),
  teacher: z.string(),
  hasDetail: z.boolean(),
});
const SubjectVtSchema = z.object({
  tests: z.array(VtTestAttemptSchema),
  fetchedAt: z.number(),
});
export const ZaznamnikSchema = z
  .object({
    ph: SubjectPhSchema,
    vt: SubjectVtSchema,
  })
  .nullable() as z.ZodType<SubjectZaznamnik | null>;

// Map store names to their schemas for runtime validation
export const StoreSchemas = {
  files: FilesSchema,
  assessments: AssessmentsSchema,
  syllabuses: SyllabusSchema,
  exams: ExamsSchema,
  schedule: ScheduleSchema,
  subjects: SubjectsSchema,
  classmates: ClassmatesSchema,
  hidden_items: HiddenItemsSchema,
  custom_events: CalendarCustomEventSchema,
  success_rates: SuccessRatesSchema,
  meta: MetaSchema,
  grade_history: GradeHistorySchema,
  study_plan: StudyPlanOrDualLanguageSchema,
  cvicne_tests: CvicneTestsSchema,
  odevzdavarny: OdevzdavarnySchema,
  erasmus: ErasmusCountryDataSchema,
  document_notes: DocumentNoteSchema,
  note_images: NoteImageSchema,
  iskam: IskamDataSchema,
  zaznamnik: ZaznamnikSchema,
  map_rooms: z.custom<import('../types/campusMap').RoomsCollection>(),
};

export type StoreName = keyof typeof StoreSchemas;
