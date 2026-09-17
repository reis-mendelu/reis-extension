import type { AppSlice, EduroamSlice } from '../types';

export const createEduroamSlice: AppSlice<EduroamSlice> = (set) => ({
  isEduroamOpen: false,
  eduroamInitialTarget: null,
  // Opening the drawer any other way (the sidebar) starts at the picker, so
  // the target is cleared on every plain open and on close.
  setIsEduroamOpen: (isOpen) => set({ isEduroamOpen: isOpen, eduroamInitialTarget: null }),
  openEduroamFor: (target) => set({ isEduroamOpen: true, eduroamInitialTarget: target }),
});
