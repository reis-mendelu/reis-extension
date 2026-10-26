import { z } from 'zod';

// reis-data `similar/<CODE>.json`: old subjects offered to preview when a
// subject has no success rates of its own. Written by reis-scraper's
// scripts/build-similar.ts.
//
// Structure is validated, domain is not: `reasons` stays an open string list so
// a reason added later does not drop the whole file (the UI shows the ones it
// knows), and `.passthrough()` keeps future fields.

export const SimilarSuggestionSchema = z
  .object({
    code: z.string().min(1),
    nameCs: z.string(),
    nameEn: z.string(),
    reasons: z.array(z.string()),
    completion: z.enum(['exam', 'credit']).nullable(),
    completionChanged: z.boolean(),
    lastYear: z.number().int().nullable(),
  })
  .passthrough();

export const SimilarFileSchema = z
  .object({
    courseCode: z.string().min(1),
    suggestions: z.array(SimilarSuggestionSchema),
  })
  .passthrough();

export type SimilarSuggestion = z.infer<typeof SimilarSuggestionSchema>;
