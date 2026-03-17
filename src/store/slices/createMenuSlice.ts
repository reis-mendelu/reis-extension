import type { MenuSlice, AppSlice } from '../types';
import { fetchMenu } from '../../api/menu';

export const createMenuSlice: AppSlice<MenuSlice> = (set) => ({
  menu: null,
  menuLoading: false,
  menuError: false,
  fetchMenu: async () => {
    set({ menuLoading: true, menuError: false });
    try {
      const data = await fetchMenu();
      set({ menu: data, menuLoading: false });
    } catch {
      set({ menuLoading: false, menuError: true });
    }
  },
});
