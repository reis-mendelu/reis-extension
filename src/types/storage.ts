import { z } from 'zod';
import type { ParsedFile, Assessment, SyllabusRequirements, SubjectsData } from '../types/documents';
import type { ExamSubject } from '../types/exams';
import type { BlockLesson } from '../types/calendarTypes';
import type { Classmate } from '../types/classmates';

// --- Base Types using Zod ---

export const ParsedFileSchema = z.custom<ParsedFile>();
export const AssessmentSchema = z.custom<Assessment>();
export const SyllabusRequirementsSchema = z.custom<SyllabusRequirements>();
export const ExamSubjectSchema = z.custom<ExamSubject>();
export const BlockLessonSchema = z.custom<BlockLesson>();
export const SubjectsDataSchema = z.custom<SubjectsData>();

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

// 'classmates' store - Array of Classmate
export const ClassmatesSchema = z.custom<Classmate[]>();

// 'meta' store - Generic metadata object
export const MetaSchema = z.any();

// Map store names to their schemas for runtime validation
export const StoreSchemas = {
    files: FilesSchema,
    assessments: AssessmentsSchema,
    syllabuses: SyllabusSchema,
    exams: ExamsSchema,
    schedule: ScheduleSchema,
    subjects: SubjectsSchema,
    classmates: ClassmatesSchema,
    success_rates: SuccessRatesSchema,
    meta: MetaSchema,
};

export type StoreName = keyof typeof StoreSchemas;
