import { z } from 'zod';
import type { ParsedFile, Assessment, SyllabusRequirements, SubjectsData, GradeHistory, DocumentNote } from '../types/documents';
import type { ExamSubject } from '../types/exams';
import type { BlockLesson, CalendarCustomEvent } from '../types/calendarTypes';
import type { ClassmatesData } from '../types/classmates';
import type { StudyPlan, DualLanguageStudyPlan } from '../types/studyPlan';
import type { CvicnyTest } from '../api/cvicneTests';
import type { Odevzdavarna } from '../api/odevzdavarny';
import type { ErasmusCountryData } from '../types/erasmus';
import type { IskamData } from './iskam';

// --- Base Types using Zod ---


export const ParsedFileSchema = z.custom<ParsedFile>();
export const AssessmentSchema = z.custom<Assessment>();
export const SyllabusRequirementsSchema = z.custom<SyllabusRequirements>();
export const ExamSubjectSchema = z.custom<ExamSubject>();
export const BlockLessonSchema = z.custom<BlockLesson>();
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
    courses: z.array(z.object({
        courseCode: z.string(),
        courseName: z.string(),
        type: z.enum(['lecture', 'seminar', 'all']).optional()
    })),
    events: z.array(z.object({
        id: z.string(),
        courseCode: z.string(),
        courseName: z.string(),
        date: z.string()
    }))
});
export const SubjectsDataSchema = z.custom<SubjectsData>();
export const StudyPlanSchema = z.union([
    z.custom<StudyPlan>(),
    z.custom<DualLanguageStudyPlan>()
]);

// --- Storage Value Schemas ---

// 'files' store - can be legacy array or dual-language object
export const FilesSchema = z.union([
    z.array(ParsedFileSchema),
    z.object({
        cz: z.array(ParsedFileSchema),
        en: z.array(ParsedFileSchema)
    })
]);

// 'assessments' store - Array of Assessment
export const AssessmentsSchema = z.array(AssessmentSchema);

// 'syllabuses' store - can be legacy single-language or dual-language object
export const SyllabusSchema = z.union([
    SyllabusRequirementsSchema,
    z.object({
        cz: SyllabusRequirementsSchema,
        en: SyllabusRequirementsSchema
    })
]);

// 'exams' store - Array of ExamSubject
export const ExamsSchema = z.array(ExamSubjectSchema);

// 'schedule' store - Array of BlockLesson
export const ScheduleSchema = z.array(BlockLessonSchema);

// 'subjects' store - SubjectsData
export const SubjectsSchema = SubjectsDataSchema;

// 'success_rates' store - Validating partial object structure
export const SuccessRatesSchema = z.record(z.string(), z.any());

// 'classmates' store - { all: Classmate[], seminar: Classmate[] }
export const ClassmatesSchema = z.custom<ClassmatesData>();

// 'meta' store - Generic metadata object
export const MetaSchema = z.any();

// 'grade_history' store - GradeHistory
export const GradeHistorySchema = z.custom<GradeHistory>();

// 'document_notes' store - DocumentNote
export const DocumentNoteSchema = z.custom<DocumentNote>();

// 'iskam' store - WebISKAM dashboard snapshot (konta + ubytovani + freshness)
export const IskamDataSchema = z.object({
    konta: z.array(z.object({
        name: z.string(),
        nameCs: z.string().optional(),
        nameEn: z.string().optional(),
        balance: z.number(),
        balanceText: z.string(),
        topUpHref: z.string().nullable(),
        transactionsHref: z.string().nullable(),
    })),
    ubytovani: z.array(z.object({
        dorm: z.string(),
        block: z.string(),
        room: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        status: z.string(),
        contractHref: z.string().nullable(),
    })),
    profile: z.object({
        fullName: z.string(),
        email: z.string(),
    }).optional(),
    reservations: z.array(z.object({
        facility: z.string(),
        room: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        price: z.string().optional(),
    })),
    pendingPayments: z.array(z.object({
        dueDate: z.string(),
        description: z.string(),
        amount: z.string(),
    })),
    stravovaniTransactions: z.array(z.object({
        datetime: z.string(),
        settledDate: z.string(),
        type: z.string(),
        description: z.string(),
        topUp: z.number().nullable(),
        payment: z.number().nullable(),
        balance: z.number(),
    })),
    syncedAt: z.number(),
}) as z.ZodType<IskamData>;

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
    study_plan: StudyPlanSchema,
    cvicne_tests: z.array(z.custom<CvicnyTest>()),
    odevzdavarny: z.array(z.custom<Odevzdavarna>()),
    erasmus: z.custom<ErasmusCountryData>(),
    document_notes: DocumentNoteSchema,
    iskam: IskamDataSchema,
};

export type StoreName = keyof typeof StoreSchemas;
