import { z } from 'zod';
import type { GradeHistory } from '../documents';

// Runtime schema for the 'grade_history' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (studium, fetchedAt, grades array,
//    and each grade's predmetId/courseName/examType/gradeText/gradeLetter);
//  - every optional CourseGrade field stays optional here;
//  - `.passthrough()` keeps unknown/future IS fields from failing a parse;
//  - `examType` is an open-ended IS value ("zk" | "záp" | "zak" | ...), so it
//    stays z.string() rather than an enum.
// It still catches real corruption: null/non-object roots, a non-array
// `grades`, or a grade entry missing its `predmetId`.

const CourseGradeSchema = z
  .object({
    period: z.string(),
    predmetId: z.string(),
    courseCode: z.string().optional(),
    courseName: z.string(),
    courseNameEn: z.string().optional(),
    examType: z.string(),
    attempt: z.number().nullable(),
    gradeText: z.string(),
    gradeLetter: z.string(),
    credits: z.number().nullable(),
  })
  .passthrough();

export const GradeHistorySchema = z
  .object({
    studium: z.string(),
    fetchedAt: z.string(),
    grades: z.array(CourseGradeSchema),
  })
  .passthrough() as unknown as z.ZodType<GradeHistory>;
