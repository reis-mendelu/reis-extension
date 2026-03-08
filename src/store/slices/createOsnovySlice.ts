import type { OsnovySlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createOsnovySlice: AppSlice<OsnovySlice> = (set) => ({
  osnovy: [],
  osnovyStatus: 'idle',
  fetchOsnovy: async () => {
    set((state) => ({ osnovyStatus: 'loading' }));
    try {
      // Get studium from user params in meta
      const userParams = await IndexedDBService.get('meta', 'reis_user_params');
      const studium = userParams?.studium;
      
      if (studium) {
        const data = await IndexedDBService.get('osnovy', studium);
        set({
          osnovy: data || [],
          osnovyStatus: 'success',
        });
      } else {
        set({ osnovyStatus: 'success', osnovy: [] });
      }


    } catch {
      set({ osnovyStatus: 'error' });
    }
  },
  setOsnovy: (tests) => {
    set({ osnovy: tests || [] });
  },
});
