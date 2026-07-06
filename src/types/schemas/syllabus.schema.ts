import { z } from 'zod';
import type { SyllabusRequirements } from '../documents';

// Runtime schema for the 'syllabuses' IndexedDB store (was a `z.custom` union no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (requirementsText, requirementsTable);
//  - every optional SyllabusRequirements/CourseMetadata field stays optional;
//  - `.passthrough()` keeps unknown/future IS fields from failing a parse.
// It still catches real corruption: null/non-object roots or a non-array
// `requirementsTable`.

const CourseMetadataSchema = z
  .object({
    courseName: z.string().nullable().optional(),
    courseNameCs: z.string().nullable().optional(),
    courseNameEn: z.string().nullable().optional(),
    courseCode: z.string().nullable().optional(),
    credits: z.string().nullable().optional(),
    garant: z
      .object({ name: z.string().nullable(), id: z.string().nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    teachers: z
      .array(
        z
          .object({ name: z.string(), id: z.string().nullable().optional(), roles: z.string() })
          .passthrough()
      )
      .optional(),
    status: z.string().nullable().optional(),
  })
  .passthrough();

export const SyllabusRequirementsSchema = z
  .object({
    version: z.number().optional(),
    language: z.string().optional(),
    courseId: z.string().optional(),
    requirementsText: z.string(),
    requirementsTable: z.array(z.array(z.string())),
    courseInfo: CourseMetadataSchema.optional(),
    objectivesText: z.string().nullable().optional(),
    contentText: z.string().nullable().optional(),
  })
  .passthrough() as unknown as z.ZodType<SyllabusRequirements>;

// 'syllabuses' store - can be legacy single-language or dual-language object
export const SyllabusSchema = z.union([
  SyllabusRequirementsSchema,
  z.object({
    cz: SyllabusRequirementsSchema,
    en: SyllabusRequirementsSchema,
  }),
]);
