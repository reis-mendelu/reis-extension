import type { AppSlice } from '../types';
import { executeAction } from '../../api/proxyClient';
import { selectStudy, adoptStoredStudy } from '../../utils/userParams';
import { IndexedDBService } from '../../services/storage';
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
  /** Another reIS tab switched study: follow it from the shared database. */
  followStudySwitch: () => Promise<void>;
  /**
   * At start: put the crawling context on the study this one shows. The two
   * records live in two databases in the extension, and clearing the IS
   * site's data or reinstalling resets only one of them; each then resolved
   * its own default, and nothing brought them back together.
   */
  reconcileStudy: () => Promise<void>;
}

/** Tells this browser's other reIS tabs that the study changed. */
export const STUDY_CHANNEL = 'reis_study_sync';
/** This tab's id on that channel, so it ignores its own announcement. */
export const STUDY_CHANNEL_SENDER = Math.random().toString(36).slice(2);

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
      // What the store holds for the previous study, by study-keyed reads
      // where there are some; exams are not keyed, and setExams keeps a list
      // over an empty push, so they are emptied until the crawl lands.
      set((s) => ({ exams: { ...s.exams, data: [] } }));
      await IndexedDBService.set('exams', 'current', []).catch(() => {});
      void get().fetchCvicneTests();
      void get().fetchOdevzdavarny();
      try {
        const bc = new BroadcastChannel(STUDY_CHANNEL);
        bc.postMessage({ from: STUDY_CHANNEL_SENDER });
        bc.close();
      } catch {
        // No BroadcastChannel: other tabs follow on their next start.
      }
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
  reconcileStudy: async () => {
    const { demoMode, impersonation, studies, studiumId } = get();
    if (demoMode || impersonation || studies.length < 2 || !studiumId) return;
    // A no-op that starts no crawl when they already agree (and always on
    // the phone, where the two are one context).
    await executeAction('select_study', { studium: studiumId }).catch((e) =>
      logError('StudySwitchSlice.reconcileStudy', e)
    );
  },
  followStudySwitch: async () => {
    if (get().demoMode || get().impersonation) return;
    await adoptStoredStudy();
    await get().loadContext();
    // The switching tab's iframe wrote the new study's data to the shared
    // extension-origin database; read it back. This tab's content script
    // follows at its next crawl (adoptStoredStudy in syncAllData).
    void get().fetchExams();
    void get().fetchSubjects();
    void get().fetchStudyPlan();
    void get().fetchCvicneTests();
    void get().fetchOdevzdavarny();
  },
});
