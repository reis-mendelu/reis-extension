import { z } from 'zod';
import type { ExamSubject } from '../exams';

// Runtime schema for the 'exams' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (ids, arrays that always exist);
//  - every optional TS field stays optional here;
//  - `.passthrough()` keeps unknown/future IS fields from failing a parse;
//  - open-ended string unions (status, attemptTypes) are widened to string so
//    a new IS value can't drop a whole exam.
// It still catches real corruption: null/non-object roots, a non-array
// `sections`/`terms`, or a missing `id`/`code`.

const ExamCapacitySchema = z
  .object({ occupied: z.number(), total: z.number(), raw: z.string() })
  .passthrough();

const ExamTermSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    time: z.string(),
    capacity: ExamCapacitySchema.optional(),
    full: z.boolean().optional(),
    room: z.string().optional(),
    teacher: z.string().optional(),
    teacherId: z.string().optional(),
    roomCs: z.string().optional(),
    roomEn: z.string().optional(),
    registrationStart: z.string().optional(),
    registrationEnd: z.string().optional(),
    deregistrationDeadline: z.string().optional(),
    attemptTypes: z.array(z.string()).optional(),
    canRegisterNow: z.boolean().optional(),
    sectionForm: z.string().optional(),
    sectionFormCs: z.string().optional(),
    sectionFormEn: z.string().optional(),
    watchdogUrl: z.string().optional(),
    blockReasonUrl: z.string().optional(),
    detailUrl: z.string().optional(),
  })
  .passthrough();

const ExamSectionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    nameCs: z.string().optional(),
    nameEn: z.string().optional(),
    type: z.string(),
    status: z.string(),
    registeredTerm: z
      .object({
        id: z.string().optional(),
        date: z.string(),
        time: z.string(),
        room: z.string().optional(),
        teacher: z.string().optional(),
        teacherId: z.string().optional(),
        roomCs: z.string().optional(),
        roomEn: z.string().optional(),
        deregistrationDeadline: z.string().optional(),
      })
      .passthrough()
      .optional(),
    terms: z.array(ExamTermSchema),
  })
  .passthrough();

export const ExamSubjectSchema = z
  .object({
    version: z.literal(1),
    id: z.string(),
    name: z.string(),
    nameCs: z.string().optional(),
    nameEn: z.string().optional(),
    code: z.string(),
    sections: z.array(ExamSectionSchema),
  })
  .passthrough() as unknown as z.ZodType<ExamSubject>;
