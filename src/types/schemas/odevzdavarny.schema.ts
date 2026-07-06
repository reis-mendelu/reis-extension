import { z } from 'zod';
import type { Odevzdavarna } from '../../api/odevzdavarny';

// Runtime schema for the 'odevzdavarny' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (courseId, name, odevzdavarnaId);
//  - `.passthrough()` keeps unknown/future fields from failing a parse;
//  - `type` is an open-ended IS `sysid` value, so it stays z.string().
// It still catches real corruption: null/non-array roots or an entry missing
// its `courseId`.

const OdevzdavarnaSchema = z
  .object({
    courseId: z.string(),
    courseNameCs: z.string(),
    courseNameEn: z.string(),
    name: z.string(),
    type: z.string(),
    deadline: z.string(),
    odevzdavarnaId: z.string(),
    fileCount: z.number(),
    uploadUrl: z.string(),
  })
  .passthrough();

export const OdevzdavarnySchema = z.array(OdevzdavarnaSchema) as unknown as z.ZodType<
  Odevzdavarna[]
>;
