import { z } from 'zod';
import type { BlockLesson } from '../calendarTypes';

// Runtime schema for the 'schedule' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (id, courseCode, courseId);
//  - every optional TS field stays optional here;
//  - `.passthrough()` keeps unknown/future IS fields from failing a parse;
//  - open-ended string fields (isSeminar, isConsultation, isDefaultCampus)
//    stay z.string() since they carry 'true'/'false' string values, not enums;
//  - `examEvent` is `any` upstream, so it's left unvalidated here too.
// It still catches real corruption: null/non-object roots, a non-array
// `teachers`, or a missing `id`/`courseCode`/`courseId`.

const TeacherSchema = z
  .object({
    fullName: z.string(),
    shortName: z.string(),
    id: z.string(),
  })
  .passthrough();

const RoomStructuredSchema = z
  .object({
    name: z.string(),
    id: z.string(),
  })
  .passthrough();

export const BlockLessonSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    courseName: z.string(),
    courseCode: z.string(),
    courseId: z.string(),
    sectionName: z.string().optional(),
    room: z.string(),
    roomStructured: RoomStructuredSchema,
    teachers: z.array(TeacherSchema),
    periodId: z.string(),
    studyId: z.string(),
    campus: z.string(),
    isDefaultCampus: z.string(),
    facultyCode: z.string(),
    isSeminar: z.string(),
    isConsultation: z.string(),
    isExam: z.boolean().optional(),
    examEvent: z.unknown().optional(),
    isFromSearch: z.boolean().optional(),
    isCustom: z.boolean().optional(),
    customEventId: z.string().optional(),
    courseNameCs: z.string().optional(),
    courseNameEn: z.string().optional(),
    roomCs: z.string().optional(),
    roomEn: z.string().optional(),
  })
  .passthrough() as unknown as z.ZodType<BlockLesson>;
