import { z } from 'zod';
import type { SubjectsData } from '../documents';

// Runtime schema for the 'subjects' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (version, lastUpdated, data record);
//  - every optional SubjectInfo field stays optional here;
//  - `.passthrough()` keeps unknown/future IS fields from failing a parse.
// It still catches real corruption: null/non-object roots, a non-object
// `data`, or a subject entry missing its `subjectCode`/`folderUrl` anchors.

const SubjectInfoSchema = z
  .object({
    displayName: z.string(),
    fullName: z.string(),
    nameCs: z.string().optional(),
    nameEn: z.string().optional(),
    subjectCode: z.string(),
    subjectId: z.string().optional(),
    skupinaId: z.string().optional(),
    folderUrl: z.string(),
    fetchedAt: z.string(),
    hasPrubezne: z.boolean().optional(),
    hasTest: z.boolean().optional(),
    autoHref: z.string().nullable().optional(),
  })
  .passthrough();

export const SubjectsDataSchema = z
  .object({
    version: z.number(),
    lastUpdated: z.string(),
    data: z.record(z.string(), SubjectInfoSchema),
  })
  .passthrough() as unknown as z.ZodType<SubjectsData>;
