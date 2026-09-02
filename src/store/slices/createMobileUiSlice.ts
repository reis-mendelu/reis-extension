import type { AppSlice, MobileUiSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

/**
 * Navigational state for the phone UI: which tab, which day, and the sheet
 * stack. A stack rather than a flag because the prototype genuinely nests
 * (Student → person, Subjects → drawer → confirm), and it gives Android
 * back-button handling for free later.
 *
 * Purely-local disclosure state (which accordion is open) deliberately stays
 * in component useState — this slice is for state that crosses components.
 */
export const createMobileUiSlice: AppSlice<MobileUiSlice> = (set) => ({
  mobileTab: 'calendar',
  mobileSelectedDayIso: null,
  mobileSheets: [],
  mapSheetState: 'peek',
  mapTab: 'akce',
  devPhoneOverride: null,
  welcomeSeen: null,

  // Read once at boot, before the root renders (capacitor/main.capacitor.tsx).
  // Same key as the desktop WelcomeModal: a device that dismissed it there has
  // dismissed it here. Demo mode is "seen" — there is no IS certificate to set
  // eduroam up from, and the reviewer's path should not open with a Wi-Fi alert.
  hydrateWelcome: async ({ demo }) => {
    if (demo) {
      set({ welcomeSeen: true });
      return;
    }
    const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
    set({ welcomeSeen: dismissed === true });
  },
  // State first, storage second: the screen must go away on the tap, and a
  // failed write is logged by the caller through the returned promise.
  dismissWelcome: async () => {
    set({ welcomeSeen: true });
    await IndexedDBService.set('meta', 'welcome_dismissed', true);
  },

  // Switching tabs closes sheets: a sheet belongs to the screen that opened it.
  setMobileTab: (tab) => set({ mobileTab: tab, mobileSheets: [] }),
  setMobileSelectedDay: (iso) => set({ mobileSelectedDayIso: iso }),

  // A push onto a sheet of the SAME kind swaps in place instead of stacking.
  // Tapping a second classmate while the first one's card is open is a lateral
  // move, not a descent, and stacking put two person cards on screen at once —
  // the new one sliding up over the one it meant to replace. Done as a single
  // store update so no frame ever renders both, and the sheet UNDERNEATH (the
  // subject drawer that opened the first card) is untouched, so back still
  // goes where it should.
  pushSheet: (sheet) =>
    set((s) => ({
      mobileSheets:
        s.mobileSheets.at(-1)?.kind === sheet.kind
          ? [...s.mobileSheets.slice(0, -1), sheet]
          : [...s.mobileSheets, sheet],
    })),
  popSheet: () => set((s) => ({ mobileSheets: s.mobileSheets.slice(0, -1) })),
  replaceSheet: (sheet) => set((s) => ({ mobileSheets: [...s.mobileSheets.slice(0, -1), sheet] })),
  closeAllSheets: () => set({ mobileSheets: [] }),

  setMapSheetState: (state) => set({ mapSheetState: state }),
  setMapTab: (tab) => set({ mapTab: tab }),
  setDevPhoneOverride: (value) => set({ devPhoneOverride: value }),
});
