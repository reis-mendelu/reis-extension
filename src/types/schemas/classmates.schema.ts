import { z } from 'zod';
import type { ClassmatesData } from '../classmates';

// Runtime schema for the 'classmates' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (personId, photoUrl, name, studyInfo);
//  - the optional messageUrl field stays optional here;
//  - `.passthrough()` keeps unknown/future fields from failing a parse.
// It still catches real corruption: null/non-array roots or an entry missing
// its `personId`/`name`.

const ClassmateSchema = z
  .object({
    personId: z.number(),
    photoUrl: z.string(),
    name: z.string(),
    studyInfo: z.string(),
    messageUrl: z.string().optional(),
  })
  .passthrough();

export const ClassmatesSchema = z.array(ClassmateSchema) as unknown as z.ZodType<ClassmatesData>;
