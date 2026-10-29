import type { CvicneTestsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { getUserParams } from '../../utils/userParams';
import { logError } from '../../utils/reportError';
import { odevzdavarnyListUrl } from '../../api/odevzdavarny';
import { boxCourseCode } from '../../utils/submissionBoxes';
import { boxKey } from '../../utils/newBoxDetection';
import { clearNewBoxes, readNewBoxes } from '../../services/sync/newSubmissionBoxes';

// Bumped by every change to `odevzdavarnyNew`, so a hydration that started
// before a sync or a "seen" does not put its older read back over them.
let newBoxesRevision = 0;

export const createCvicneTestsSlice: AppSlice<CvicneTestsSlice> = (set, get) => ({
  cvicneTests: [],
  cvicneTestsStatus: 'idle',
  fetchCvicneTests: async () => {
    if (get().cvicneTestsStatus === 'loading') return;
    if (get().cvicneTests.length === 0) {
      set(() => ({ cvicneTestsStatus: 'loading' }));
    }
    try {
      // Prefer context store (already loaded), fall back to getUserParams
      const studium = get().studiumId || (await getUserParams())?.studium;

      if (studium) {
        const data = await IndexedDBService.get('cvicne_tests', studium);
        set({
          cvicneTests: data || [],
          cvicneTestsStatus: 'success',
        });
      } else {
        set({ cvicneTestsStatus: 'success', cvicneTests: [] });
      }
    } catch (e) {
      logError('CvicneTestsSlice.fetchCvicneTests', e);
      set({ cvicneTestsStatus: 'error' });
    }
  },
  setCvicneTests: (tests) => {
    set({ cvicneTests: tests || [] });
  },
  odevzdavarny: [],
  odevzdavarnyStatus: 'idle',
  fetchOdevzdavarny: async () => {
    if (get().odevzdavarnyStatus === 'loading') return;
    if (get().odevzdavarny.length === 0) {
      set(() => ({ odevzdavarnyStatus: 'loading' }));
    }
    // Before the first await: whatever changes the new boxes from here on is
    // newer than what this hydration will read.
    const revision = newBoxesRevision;
    try {
      // Prefer context store (already loaded), fall back to getUserParams
      const params = await getUserParams();
      const studium = get().studiumId || params?.studium;
      const obdobi = get().obdobiId || params?.obdobi;

      if (studium && obdobi) {
        const [data, unseen] = await Promise.all([
          IndexedDBService.get('odevzdavarny', `${studium}_${obdobi}`),
          // Through the queue: a read beside a persist could bring back a box
          // the student has just seen. Its failure must not cost the boxes,
          // nor the new ones already on screen.
          readNewBoxes().catch((err) => {
            logError('CvicneTestsSlice.readNewBoxes', err);
            return null;
          }),
        ]);
        // 5.3.0 cached `uploadUrl: ''` for a row with no upload link, and an
        // empty href opens the app's own page. The fetcher now falls back to
        // the period's list; rows read back from that cache get the same.
        const boxes = (data || []).map((a) =>
          a.uploadUrl ? a : { ...a, uploadUrl: odevzdavarnyListUrl(studium, a.obdobi ?? obdobi) }
        );
        set({
          odevzdavarny: boxes,
          odevzdavarnyStatus: 'success',
          ...(unseen && revision === newBoxesRevision ? { odevzdavarnyNew: unseen } : {}),
        });
      } else {
        set({ odevzdavarnyStatus: 'success', odevzdavarny: [] });
      }
    } catch (e) {
      logError('CvicneTestsSlice.fetchOdevzdavarny', e);
      set({ odevzdavarnyStatus: 'error' });
    }
  },
  setOdevzdavarny: (assignments) => {
    set({ odevzdavarny: assignments || [] });
  },
  odevzdavarnyNew: [],
  setOdevzdavarnyNew: (keys) => {
    newBoxesRevision++;
    set({ odevzdavarnyNew: keys });
  },
  odevzdavarnySeenNew: [],
  markBoxesSeen: async (courseCode) => {
    const { odevzdavarny, odevzdavarnyNew, subjects } = get();
    const seen = new Set(
      odevzdavarny
        .filter((b) => boxCourseCode(b, subjects?.data) === courseCode)
        .map(boxKey)
        .filter((k) => odevzdavarnyNew.includes(k))
    );
    if (seen.size === 0) return;
    newBoxesRevision++;
    set((s) => ({
      odevzdavarnyNew: s.odevzdavarnyNew.filter((k) => !seen.has(k)),
      odevzdavarnySeenNew: [...new Set([...s.odevzdavarnySeenNew, ...seen])],
    }));
    try {
      // What is stored once the clear has its turn: a sync answered in the
      // meantime may have put this subject's box back on screen.
      const rest = await clearNewBoxes([...seen]);
      newBoxesRevision++;
      set((s) => ({ odevzdavarnyNew: s.odevzdavarnyNew.filter((k) => rest.includes(k)) }));
    } catch (err) {
      logError('CvicneTestsSlice.markBoxesSeen', err);
    }
  },
});
