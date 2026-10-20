import { getUserParams, clearUserParamsCache } from '../../utils/userParams';
import { setPreferredStudium } from '../../utils/userParams/studyPreference';
import { executeAction, isInIframe } from '../../api/proxyClient';

/**
 * Move a student with two studies onto `studium`. True once this context runs
 * on it.
 *
 * The pick is stored first (shared storage both extension contexts read), then
 * each context re-reads its params, which is where `getUserParams` drops the
 * old study's cache and — through `watchSignedInStudent` — restarts the app.
 * In the extension the host page goes first: it holds its own params, its own
 * IndexedDB and the sync's in-memory data, and the iframe must not reload to
 * the old study's data still sitting there.
 */
export async function switchStudy(studium: string): Promise<boolean> {
  const current = await getUserParams();
  if (!current?.studentId) return false;
  if (current.studium === studium) return true;

  // Both contexts back on the old study. The host page is told too, even when
  // its own request failed: a timeout is not a refusal, and a host still
  // working would otherwise finish on the new study while this one stayed.
  // Its re-read joins the one in flight, so it ends on the old study either way.
  const back = async () => {
    await setPreferredStudium(current.studentId, current.studium);
    if (isInIframe())
      await executeAction('switch_study', { studium: current.studium }).catch(() => {});
  };
  await setPreferredStudium(current.studentId, studium);
  if (isInIframe()) {
    try {
      await executeAction('switch_study', { studium });
    } catch (e) {
      await back();
      throw e;
    }
  }
  clearUserParamsCache();
  if ((await getUserParams())?.studium === studium) return true;
  await back();
  return false;
}
