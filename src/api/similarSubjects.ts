/**
 * Similar subjects for a subject with no success rates — reis-data
 * `similar/<CODE>.json`. Asked only after the subject's own stats came back
 * empty (see createSuccessRateSlice). A 404 is the normal answer: no file
 * means reIS has nothing to suggest.
 */
import { CDN_BASE_URL } from './successRate';
import { SimilarFileSchema, type SimilarSuggestion } from '../types/schemas/similarSubjects.schema';

export const MAX_SIMILAR = 3;

export async function fetchSimilarSubjects(courseCode: string): Promise<SimilarSuggestion[]> {
  // Same revalidation as subjects/: jsDelivr's week-long max-age would
  // otherwise hand back a copy from before the last refresh.
  const response = await fetch(`${CDN_BASE_URL}/similar/${courseCode}.json`, { cache: 'no-cache' });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const parsed = SimilarFileSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error(`similar/${courseCode}.json: ${parsed.error.message}`);
  if (parsed.data.courseCode !== courseCode) {
    throw new Error(`similar/${courseCode}.json is for ${parsed.data.courseCode}`);
  }
  return parsed.data.suggestions.slice(0, MAX_SIMILAR);
}
