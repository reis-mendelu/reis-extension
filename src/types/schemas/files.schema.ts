import { z } from 'zod';
import type { ParsedFile } from '../documents';

// Runtime schema for the 'files' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (subfolder, file_name, files array);
//  - every optional ParsedFile field stays optional here;
//  - `.passthrough()` keeps unknown/future IS fields from failing a parse.
// It still catches real corruption: null/non-object roots or a non-array
// `files` field.

const FileAttachmentSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    link: z.string(),
  })
  .passthrough();

export const ParsedFileSchema = z
  .object({
    subfolder: z.string(),
    file_name: z.string(),
    file_comment: z.string(),
    author: z.string(),
    date: z.string(),
    files: z.array(FileAttachmentSchema),
    language: z.string().optional(),
  })
  .passthrough() as unknown as z.ZodType<ParsedFile>;

// 'files' store - can be legacy array or dual-language object
export const FilesSchema = z.union([
  z.array(ParsedFileSchema),
  z.object({
    cz: z.array(ParsedFileSchema),
    en: z.array(ParsedFileSchema),
  }),
]);
