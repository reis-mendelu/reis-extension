import type { NavPagesSlice, AppSlice } from '../types';
import type { PageCategory } from '../../data/pages/types';

export const createNavPagesSlice: AppSlice<NavPagesSlice> = (set) => ({
  navPages: null,
  setNavPages: (pages: PageCategory[]) => set({ navPages: pages }),
});
