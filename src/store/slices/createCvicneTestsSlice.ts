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
        console.log('[cvicneTests] fetchCvicneTests from IDB:', { studium, count: data?.length, data });
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
    console.log('[cvicneTests] setCvicneTests called:', { count: tests?.length, tests });
    set({ cvicneTests: tests || [] });
  },
});
