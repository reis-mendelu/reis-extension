import type { AppSlice, EduroamSlice } from '../types';

export const createEduroamSlice: AppSlice<EduroamSlice> = (set) => ({
  isEduroamOpen: false,
  eduroamInitialTarget: null,
  // Opening the drawer any other way (the profile popup) starts at the picker,
  // so the target is cleared on every plain open and on close.
  setIsEduroamOpen: (isOpen) => set({ isEduroamOpen: isOpen, eduroamInitialTarget: null }),
  // The one hand-off both entry points use — the welcome modal and the Profil
  // row — so the drawer's picker is skipped wherever a student comes from.
  openEduroamFor: (target) => set({ isEduroamOpen: true, eduroamInitialTarget: target }),
});
