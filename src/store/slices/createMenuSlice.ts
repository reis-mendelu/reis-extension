import type { MenuSlice, AppSlice } from '../types';
import { fetchMenu } from '../../api/menu';

export const createMenuSlice: AppSlice<MenuSlice> = (set, get) => ({
  menu: null,
  menuLoading: false,
  menuError: false,
  fetchMenu: async () => {
    set({ menuLoading: true, menuError: false });
    try {
      const data = await fetchMenu(get().language);
      set({ menu: data, menuLoading: false });
    } catch {
      set({ menuLoading: false, menuError: true });
    }
  },
});
