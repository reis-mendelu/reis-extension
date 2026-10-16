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
    if (get().demoMode || get().studySwitching) return false;
    if (studium === get().studiumId) return true;
    set({ studySwitching: true });
    try {
      // The context that crawls, first: in the extension that is the
      // content script, with its own user params in the host-origin
      // database. It switches and starts the crawl. On the phone it is this
      // same context, and the second call below is then a no-op.
      await executeAction('select_study', { studium });
      await selectStudy(studium);
      await get().loadContext();
      return true;
    } catch (e) {
      logError('StudySwitchSlice.switchStudy', e);
      return false;
    } finally {
      set({ studySwitching: false });
    }
  },
});
