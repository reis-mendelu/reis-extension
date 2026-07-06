import { z } from 'zod';
import type { CvicnyTest } from '../../api/cvicneTests';

// Runtime schema for the 'cvicne_tests' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (courseId, name, url);
//  - `.passthrough()` keeps unknown/future fields from failing a parse;
//  - `status` ('accessible' | 'inaccessible') is widened to z.string() so a
//    new IS status value can't drop the whole entry.
// It still catches real corruption: null/non-array roots or an entry missing
// its `courseId`.

const CvicnyTestSchema = z
  .object({
    courseId: z.string(),
    courseNameCs: z.string(),
    courseNameEn: z.string(),
    name: z.string(),
    url: z.string(),
    status: z.string(),
  })
  .passthrough();

export const CvicneTestsSchema = z.array(CvicnyTestSchema) as unknown as z.ZodType<CvicnyTest[]>;
