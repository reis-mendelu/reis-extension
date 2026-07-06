import { z } from 'zod';
import type { DocumentNote } from '../documents';

// Runtime schema for the 'document_notes' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (note, updatedAt);
//  - the optional fileName field stays optional here;
//  - `.passthrough()` keeps unknown/future fields from failing a parse.
// It still catches real corruption: null/non-object roots or a missing
// `note`/`updatedAt`.

export const DocumentNoteSchema = z
  .object({
    note: z.string(),
    updatedAt: z.number(),
    fileName: z.string().optional(),
  })
  .passthrough() as unknown as z.ZodType<DocumentNote>;
