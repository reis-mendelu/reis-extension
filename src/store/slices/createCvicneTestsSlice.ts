import type { CvicneTestsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { getUserParams } from '../../utils/userParams';
import { logError } from '../../utils/reportError';
import { odevzdavarnyListUrl } from '../../api/odevzdavarny';
import { boxCourseCode } from '../../utils/submissionBoxes';
import { boxKey } from '../../utils/newSubmissionBoxes';
import { clearNewBoxes, NEW_BOXES_META_KEY } from '../../services/sync/newSubmissionBoxes';

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
    try {
      // Prefer context store (already loaded), fall back to getUserParams
      const params = await getUserParams();
      const studium = get().studiumId || params?.studium;
      const obdobi = get().obdobiId || params?.obdobi;

      if (studium && obdobi) {
        const [data, unseen] = await Promise.all([
          IndexedDBService.get('odevzdavarny', `${studium}_${obdobi}`),
          IndexedDBService.get('meta', NEW_BOXES_META_KEY) as Promise<string[] | undefined>,
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
          odevzdavarnyNew: unseen ?? [],
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
  setOdevzdavarnyNew: (keys) => set({ odevzdavarnyNew: keys }),
  markBoxesSeen: async (courseCode) => {
    const { odevzdavarny, odevzdavarnyNew, subjects } = get();
    const seen = new Set(
      odevzdavarny
        .filter((b) => boxCourseCode(b, subjects?.data) === courseCode)
        .map(boxKey)
        .filter((k) => odevzdavarnyNew.includes(k))
    );
    if (seen.size === 0) return;
    set((s) => ({ odevzdavarnyNew: s.odevzdavarnyNew.filter((k) => !seen.has(k)) }));
    try {
      await clearNewBoxes([...seen]);
    } catch (err) {
      logError('CvicneTestsSlice.markBoxesSeen', err);
    }
  },
});
