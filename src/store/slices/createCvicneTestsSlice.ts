import type { CvicneTestsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { getUserParams } from '../../utils/userParams';
import { logError } from '../../utils/reportError';
import { odevzdavarnyListUrl } from '../../api/odevzdavarny';

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
        const data = await IndexedDBService.get('odevzdavarny', `${studium}_${obdobi}`);
        // 5.3.0 cached `uploadUrl: ''` for a row with no upload link, and an
        // empty href opens the app's own page. The fetcher now falls back to
        // the period's list; rows read back from that cache get the same.
        const boxes = (data || []).map((a) =>
          a.uploadUrl ? a : { ...a, uploadUrl: odevzdavarnyListUrl(studium, a.obdobi ?? obdobi) }
        );
        set({
          odevzdavarny: boxes,
          odevzdavarnyStatus: 'success',
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
});
