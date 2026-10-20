import { forgetStudyData } from './syncService';
import { requestSync, whenSyncIdle } from './syncGate';
import { clearUserParamsCache, getUserParams } from '../utils/userParams';
import { setPreferredStudium } from '../utils/userParams/studyPreference';

/**
 * The host page's half of a study switch (see `services/identity/switchStudy`).
 *
 * This context keeps its own params record, its own IndexedDB and the sync's
 * in-memory data, none of which the iframe can reach. Re-reading the params is
 * what moves the record and drops the old study's host-origin cache
 * (`past_semester_*`, `classmates`).
 *
 * Throws when the re-read did not land on `studium` — IS answered the default
 * page but not the chosen study's — so the iframe does not move alone and the
 * two contexts never run on different studies. Resolves before the crawl of
 * the new study, which waits for any crawl of the old one to finish: joining
 * that crawl would leave the new study never fetched.
 *
 * The iframe has already stored the pick in the storage both contexts share;
 * it is stored again here from the message itself, so this half never depends
 * on reading back what the other context just wrote.
 */
export async function switchStudyOnHost(studium: string): Promise<void> {
  const current = await getUserParams();
  if (current?.studentId) await setPreferredStudium(current.studentId, studium);
  clearUserParamsCache();
  const moved = await getUserParams();
  if (moved?.studium !== studium) {
    // Not served from cache for the rest of the session: the next read asks IS.
    clearUserParamsCache();
    throw new Error('switch_study: IS did not confirm the chosen study');
  }
  forgetStudyData();
  void whenSyncIdle().then(() => requestSync('user'));
}
