import { z } from 'zod';
import type { ErasmusCountryData } from '../erasmus';

// Runtime schema for the 'erasmus' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. This data is sourced from the
// reis-data CDN (see CLAUDE.md), not parsed live from IS, but the same
// "never drop valid data" rule applies. Therefore:
//  - only structural anchors are required (meta.country/countryId, reports
//    array, each report's reportId);
//  - every other ErasmusReport field is treated as optional here even though
//    the TS type marks them required — a CDN field renamed/dropped upstream
//    should never sink the whole report;
//  - `.passthrough()` on every nested object keeps unknown/future fields
//    from failing a parse.
// It still catches real corruption: null/non-object roots, a non-array
// `reports`, or a report missing its `reportId`.

const strOpt = z.string().optional();

const ErasmusReportSchema = z
  .object({
    reportId: z.string(),
    student: z
      .object({ name: strOpt, email: strOpt, faculty: strOpt, coordinator: strOpt })
      .passthrough()
      .optional(),
    host: z
      .object({
        name: strOpt,
        country: strOpt,
        coordinators: strOpt,
        address: strOpt,
        email: strOpt,
        phone: strOpt,
      })
      .passthrough()
      .optional(),
    stay: z
      .object({ from: strOpt, to: strOpt, durationMonths: z.number().optional() })
      .passthrough()
      .optional(),
    preparation: z.record(z.string(), z.unknown()).optional(),
    admission: z
      .object({ studyDocs: strOpt, adminDocs: strOpt, fees: strOpt })
      .passthrough()
      .optional(),
    accommodation: z.record(z.string(), z.unknown()).optional(),
    study: z.record(z.string(), z.unknown()).optional(),
    recognition: z
      .object({ recognized: strOpt, conditions: strOpt, problems: strOpt })
      .passthrough()
      .optional(),
    finance: z.record(z.string(), z.unknown()).optional(),
    leisure: z.record(z.string(), z.unknown()).optional(),
    tips: z.record(z.string(), z.unknown()).optional(),
    cooperation: z.object({ willing: strOpt, howHelp: strOpt }).passthrough().optional(),
    overall: z
      .object({ rating: strOpt, review: strOpt, suggestions: strOpt })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const ErasmusCountryDataSchema = z
  .object({
    meta: z
      .object({
        country: z.string(),
        countryId: z.string(),
        type: z.string(),
        reportCount: z.number(),
        scrapedAt: z.string(),
      })
      .passthrough(),
    reports: z.array(ErasmusReportSchema),
  })
  .passthrough() as unknown as z.ZodType<ErasmusCountryData>;
