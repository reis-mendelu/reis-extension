import type { AppSlice } from '../types';
import { executeAction } from '../../api/proxyClient';
import { selectStudy } from '../../utils/userParams';
import { logError } from '../../utils/reportError';

export interface StudySwitchSlice {
  /** A switch is in flight: the switcher shows it and takes no second tap. */
  studySwitching: boolean;
  /**
   * Point reIS at another of the student's active studies (`studies` on the
   * context slice). Resolves true once both contexts name it; the crawl of
   * the new study runs after that and lands like any sync.
   */
  switchStudy: (studium: string) => Promise<boolean>;
}

export const createStudySwitchSlice: AppSlice<StudySwitchSlice> = (set, get) => ({
  studySwitching: false,
  switchStudy: async (studium) => {
    // Impersonation shows another student's data over this one's record;
    // switching would re-point the admin's own study underneath it.
    if (get().demoMode || get().impersonation || get().studySwitching) return false;
    const previous = get().studiumId;
    if (studium === previous) return true;
    set({ studySwitching: true });
    let crawlerSwitched = false;
    try {
      // The context that crawls, first: in the extension that is the
      // content script, with its own user params in the host-origin
      // database. It switches and starts the crawl. On the phone it is this
      // same context, and the second call below is then a no-op.
      try {
        await executeAction('select_study', { studium });
        crawlerSwitched = true;
      } catch (e) {
        // A timeout does not mean it did not happen: the content script may
        // still switch once IS answers. Naming the study in use undoes that,
        // and is a no-op that starts no crawl if it never switched.
        if (previous) void executeAction('select_study', { studium: previous }).catch(() => {});
        throw e;
      }
      await selectStudy(studium);
      await get().loadContext();
      return true;
    } catch (e) {
      // This context could not follow: put the crawling one back, so the two
      // never stay on different studies — both records are persisted.
      if (crawlerSwitched && previous)
        await executeAction('select_study', { studium: previous }).catch(() => {});
      logError('StudySwitchSlice.switchStudy', e);
      return false;
    } finally {
      set({ studySwitching: false });
    }
  },
});
