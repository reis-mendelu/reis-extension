import { z } from 'zod';
import type { SuccessRateData, SubjectSuccessRate } from '../documents';

// Runtime schema for the 'success_rates' IndexedDB store (was z.record(string, any)).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (courseCode/stats, or lastUpdated/data);
//  - every optional field stays optional here;
//  - `.passthrough()` keeps unknown/future fields from failing a parse;
//  - open-ended string unions (SemesterStats.type) are widened to string.
// The store holds two shapes depending on the IDB key: the aggregate
// SuccessRateData (key 'current', written by successRate.ts) or a bare
// SubjectSuccessRate (per-course-code keys, written by MockManager). It
// still catches real corruption: null/non-object roots, non-array `stats`,
// or a missing `courseCode`/`lastUpdated`.

const GradeStatsSchema = z
  .object({
    A: z.number(),
    B: z.number(),
    C: z.number(),
    D: z.number(),
    E: z.number(),
    F: z.number(),
    FN: z.number(),
  })
  .passthrough();

const CreditStatsSchema = z
  .object({
    zap: z.number(),
    nezap: z.number(),
    zapNedost: z.number(),
  })
  .passthrough();

const TermStatsSchema = z
  .object({
    term: z.string(),
    grades: GradeStatsSchema,
    creditGrades: CreditStatsSchema.optional(),
    pass: z.number(),
    fail: z.number(),
  })
  .passthrough();

const SemesterStatsSchema = z
  .object({
    semesterName: z.string(),
    semesterId: z.string(),
    year: z.number(),
    totalPass: z.number(),
    totalFail: z.number(),
    sourceUrl: z.string().optional(),
    type: z.string(),
    terms: z.array(TermStatsSchema),
  })
  .passthrough();

export const SubjectSuccessRateSchema = z
  .object({
    courseCode: z.string(),
    stats: z.array(SemesterStatsSchema),
    lastUpdated: z.string(),
    predmetId: z.string().optional(),
  })
  .passthrough() as unknown as z.ZodType<SubjectSuccessRate>;

export const SuccessRateDataSchema = z
  .object({
    lastUpdated: z.string(),
    data: z.record(z.string(), SubjectSuccessRateSchema),
  })
  .passthrough() as unknown as z.ZodType<SuccessRateData>;

// 'success_rates' store - either the aggregate (key 'current') or a bare
// per-subject entry (course-code keys, used by MockManager).
export const SuccessRatesSchema = z.union([SuccessRateDataSchema, SubjectSuccessRateSchema]);
