import type { AppSlice, EduroamSlice } from '../types';

export const createEduroamSlice: AppSlice<EduroamSlice> = (set) => ({
  isEduroamOpen: false,
  setIsEduroamOpen: (isOpen) => set({ isEduroamOpen: isOpen }),
});
