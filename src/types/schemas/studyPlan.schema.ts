import { z } from 'zod';
import type { StudyPlan, DualLanguageStudyPlan } from '../studyPlan';

// Runtime schema for the 'study_plan' IndexedDB store (was a `z.custom` union no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (title, blocks array, groups array,
//    subjects array, and each subject's id/code/name);
//  - every optional field stays optional here;
//  - `.passthrough()` keeps unknown/future fields from failing a parse;
//  - `type` (SubjectStatus) is an open-ended IS value, so it stays z.string().
// It still catches real corruption: null/non-object roots, a non-array
// `blocks`/`groups`/`subjects`, or a subject missing its `code`.

const SubjectStatusSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    credits: z.number(),
    type: z.string(),
    isEnrolled: z.boolean(),
    isFulfilled: z.boolean(),
    enrollmentCount: z.number(),
    fulfillmentDate: z.string().optional(),
    rawStatusText: z.string(),
  })
  .passthrough();

const SubjectGroupSchema = z
  .object({
    name: z.string(),
    statusDescription: z.string(),
    subjects: z.array(SubjectStatusSchema),
    minCount: z.number().optional(),
    minCredits: z.number().optional(),
  })
  .passthrough();

const SemesterBlockSchema = z
  .object({
    title: z.string(),
    groups: z.array(SubjectGroupSchema),
    isWholePlanPool: z.boolean().optional(),
  })
  .passthrough();

const ZamerangSubjectRefSchema = z
  .object({
    code: z.string(),
    name: z.string(),
  })
  .passthrough();

const ZamerangSchema = z
  .object({
    name: z.string(),
    subjects: z.array(ZamerangSubjectRefSchema),
    description: z.string().optional(),
  })
  .passthrough();

export const StudyPlanSchema = z
  .object({
    title: z.string(),
    isFulfilled: z.boolean(),
    creditsAcquired: z.number(),
    creditsRequired: z.number(),
    blocks: z.array(SemesterBlockSchema),
    zameranis: z.array(ZamerangSchema).optional(),
    zameraniMinimum: z.number().optional(),
  })
  .passthrough() as unknown as z.ZodType<StudyPlan>;

export const DualLanguageStudyPlanSchema = z
  .object({
    cz: StudyPlanSchema,
    en: StudyPlanSchema,
  })
  .passthrough() as unknown as z.ZodType<DualLanguageStudyPlan>;

export const StudyPlanOrDualLanguageSchema = z.union([
  StudyPlanSchema,
  DualLanguageStudyPlanSchema,
]);
