import type { TeachingWeekSlice, AppSlice } from '../types';
import { fetchTeachingWeeks, type TeachingWeekData } from '../../api/teachingWeek';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/** One key in the shared `meta` bucket — the table is a few hundred bytes. */
const CACHE_KEY = 'teaching_weeks';

/**
 * Is this cached table still about the semester we are in?
 *
 * A table is a list of dated weeks, so one whose LAST week has already ended
 * belongs to a semester that is over. Trusting it would answer "outside the
 * teaching period" from last year's dates, which is the confident wrong answer
 * this cache exists to prevent — better to claim nothing until the fetch lands.
 */
function stillCurrent(data: TeachingWeekData, now: Date): boolean {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return data.weeks.some((w) => w.to >= today);
}

/**
 * Narrow what came back out of the `meta` bucket.
 *
 * `meta` is a heterogeneous key-value store validated only down to "some JSON
 * value" (see types/schemas/meta.schema.ts), so the shape check is this
 * caller's job. Everything downstream reads `weeks[].from`/`.to` as strings and
 * would compare `undefined` against a date if they were anything else.
 */
function isTeachingWeekData(value: unknown): value is TeachingWeekData {
  if (typeof value !== 'object' || value === null) return false;
  const { weeks, total } = value as { weeks?: unknown; total?: unknown };
  if (!Array.isArray(weeks) || typeof total !== 'number') return false;
  return weeks.every((w) => {
    if (typeof w !== 'object' || w === null) return false;
    const entry = w as { week?: unknown; from?: unknown; to?: unknown };
    return (
      typeof entry.week === 'number' &&
      typeof entry.from === 'string' &&
      typeof entry.to === 'string'
    );
  });
}

export const createTeachingWeekSlice: AppSlice<TeachingWeekSlice> = (set) => ({
  teachingWeekData: null,
  /**
   * Cache first, then the network.
   *
   * This was the only domain the phone re-fetched from scratch on every launch
   * while `schedule` rehydrated from IndexedDB, and `isOutsideTeaching` has no
   * other input. The asymmetry showed: before term the calendar opened on
   * today, then visibly jumped to the first teaching day a few seconds later
   * when the table finally arrived. Reading the cache first removes the jump
   * without making the fetch any less authoritative — it still overwrites.
   */
  fetchTeachingWeek: async () => {
    try {
      const cached = await IndexedDBService.get('meta', CACHE_KEY);
      // Only as a head start: a fetch that has already won the race must not be
      // undone by a slow disk read.
      if (isTeachingWeekData(cached) && stillCurrent(cached, new Date())) {
        set((s) => (s.teachingWeekData ? {} : { teachingWeekData: cached }));
      }
    } catch (e) {
      // A cache miss is not a failure — carry on to the fetch.
      logError('TeachingWeekSlice.readCache', e);
    }

    const data = await fetchTeachingWeeks();
    // Null is "offline, or IS returned something the parser could not read".
    // Keeping the cached table beats blanking the screen back to "we don't
    // know", and writing null would poison the cache for the next launch.
    if (!data) return;

    set({ teachingWeekData: data });
    try {
      await IndexedDBService.set('meta', CACHE_KEY, data);
    } catch (e) {
      logError('TeachingWeekSlice.writeCache', e);
    }
  },
});
