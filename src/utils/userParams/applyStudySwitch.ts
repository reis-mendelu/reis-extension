import { logError } from '../reportError';

/**
 * The crawling context's half of a study switch — the `select_study` action,
 * answered by the content script in the extension and by the app itself on
 * the phone. One function so the two handlers cannot drift apart.
 *
 * The record is re-pointed BEFORE the reply, so the caller's own context can
 * follow; the crawl of the new study runs after it and is not awaited, since
 * it can take a while. A `studium` that is already the one in use changes
 * nothing and starts no crawl — which is what makes the caller's rollback
 * after a timeout safe to send.
 */
export async function applyStudySwitch(
  studium: string | undefined,
  select: (studium: string) => Promise<{ changed: boolean }>,
  sync: () => Promise<unknown>
): Promise<{ success: true; changed: boolean }> {
  if (!studium) throw new Error('select_study: missing studium');
  const { changed } = await select(studium);
  if (changed) void sync().catch((e) => logError('select_study.sync', e));
  return { success: true, changed };
}
