import type { CvicneTestsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { getUserParams } from '../../utils/userParams';

export const createCvicneTestsSlice: AppSlice<CvicneTestsSlice> = (set, get) => ({
  cvicneTests: [],
  cvicneTestsStatus: 'idle',
  fetchCvicneTests: async () => {
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
      console.warn('[CvicneTestsSlice] fetchCvicneTests failed:', e);
      set({ cvicneTestsStatus: 'error' });
    }
  },
  setCvicneTests: (tests) => {
    set({ cvicneTests: tests || [] });
  },
  odevzdavarny: [],
  odevzdavarnyStatus: 'idle',
  fetchOdevzdavarny: async () => {
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
        set({
          odevzdavarny: data || [],
          odevzdavarnyStatus: 'success',
        });
      } else {
        set({ odevzdavarnyStatus: 'success', odevzdavarny: [] });
      }
    } catch (e) {
      console.warn('[CvicneTestsSlice] fetchOdevzdavarny failed:', e);
      set({ odevzdavarnyStatus: 'error' });
    }
  },
  setOdevzdavarny: (assignments) => {
    set({ odevzdavarny: assignments || [] });
  },
});
