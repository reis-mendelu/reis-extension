import type { AppSlice, SimilarSubjectsSlice } from '../types';
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';
import { fetchSimilarSubjects } from '../../api/similarSubjects';
import { isStaleForVersion } from '../../api/successRate';
import { ensureSuccessRateVersion } from '../../api/successRateVersion';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { STORAGE_KEYS } from '../../services/storage/keys';
import { logError } from '../../utils/reportError';

/** Persisted in `meta`, stamped with the reis-data version like success rates,
 * so a refresh reaches the Capacitor apps too — they never restart the way
 * the extension's iframe does. */
type Cache = Record<string, { suggestions: SimilarSuggestion[]; cdnVersion?: string }>;

const inFlight = new Set<string>();

const readCache = async (): Promise<Cache> =>
  ((await IndexedDBService.get('meta', STORAGE_KEYS.SIMILAR_SUBJECTS)) as Cache | undefined) ?? {};

export const createSimilarSubjectsSlice: AppSlice<SimilarSubjectsSlice> = (set, get) => ({
  similarSubjects: {},
  fetchSimilarSubjects: async (courseCode) => {
    if (inFlight.has(courseCode)) return;
    inFlight.add(courseCode);
    const show = (suggestions: SimilarSuggestion[]) => {
      set((state) => ({
        similarSubjects: { ...state.similarSubjects, [courseCode]: suggestions },
      }));
      // Each row shows the old subject's fail rate, so its stats load now,
      // under its own code, through the path the Předměty list already uses.
      if (suggestions.length) void get().fetchSuccessRateBatch(suggestions.map((x) => x.code));
    };
    try {
      const hit = (await readCache())[courseCode];
      if (hit) show(hit.suggestions);

      const version = await ensureSuccessRateVersion();
      if (hit && !isStaleForVersion(hit, version)) return;

      const suggestions = await fetchSimilarSubjects(courseCode);
      show(suggestions);
      await IndexedDBService.set('meta', STORAGE_KEYS.SIMILAR_SUBJECTS, {
        ...(await readCache()),
        [courseCode]: version === null ? { suggestions } : { suggestions, cdnVersion: version },
      });
    } catch (err) {
      logError('Api.fetchSimilarSubjects', err, { courseCode });
      // Nothing to suggest is the safe answer: the tab shows its plain empty state.
      if (!get().similarSubjects[courseCode]) show([]);
    } finally {
      inFlight.delete(courseCode);
    }
  },
});
