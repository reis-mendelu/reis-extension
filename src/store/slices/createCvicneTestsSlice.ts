import type { CvicneTestsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createCvicneTestsSlice: AppSlice<CvicneTestsSlice> = (set) => ({
  cvicneTests: [],
  cvicneTestsStatus: 'idle',
  fetchCvicneTests: async () => {
    set(() => ({ cvicneTestsStatus: 'loading' }));
    try {
      const userParams = await IndexedDBService.get('meta', 'reis_user_params');
      const studium = userParams?.studium;

      if (studium) {
        const data = await IndexedDBService.get('cvicne_tests', studium);
        set({
          cvicneTests: data || [],
          cvicneTestsStatus: 'success',
        });
      } else {
        set({ cvicneTestsStatus: 'success', cvicneTests: [] });
      }
    } catch {
      set({ cvicneTestsStatus: 'error' });
    }
  },
  setCvicneTests: (tests) => {
    set({ cvicneTests: tests || [] });
  },
  odevzdavarny: [],
  odevzdavarnyStatus: 'idle',
  fetchOdevzdavarny: async () => {
    set(() => ({ odevzdavarnyStatus: 'loading' }));
    try {
      const userParams = await IndexedDBService.get('meta', 'reis_user_params');
      const studium = userParams?.studium;
      const obdobi = userParams?.obdobi;

      if (studium && obdobi) {
        const data = await IndexedDBService.get('odevzdavarny', `${studium}_${obdobi}`);
        set({
          odevzdavarny: data || [],
          odevzdavarnyStatus: 'success',
        });
      } else {
        set({ odevzdavarnyStatus: 'success', odevzdavarny: [] });
      }
    } catch {
      set({ odevzdavarnyStatus: 'error' });
    }
  },
  setOdevzdavarny: (assignments) => {
    set({ odevzdavarny: assignments || [] });
  },
});
