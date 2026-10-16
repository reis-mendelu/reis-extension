import { resetSyncTtl } from './syncTtl';

/** The study the content script's cached data was last crawled for. */
let cachedForStudium: string | null = null;

/**
 * Has the study changed since the last crawl? The student switched — here,
 * or in another IS tab whose switch this one adopted. When it has, the
 * freshness stamps go too: they describe the previous study's data, and a
 * young one would skip the new study's fetch. The first crawl of a context
 * is not a change. The caller drops its study-scoped cache on `true`.
 */
export function studyChanged(studium: string | undefined): boolean {
  if (!studium) return false;
  const previous = cachedForStudium;
  cachedForStudium = studium;
  if (previous === null || previous === studium) return false;
  resetSyncTtl();
  return true;
}
