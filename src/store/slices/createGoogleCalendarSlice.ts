import type { AppSlice, GoogleCalendarSlice } from '../types';

/**
 * State only. The work lives in src/mobile/googleCalendar, which the phone
 * tree installs from capacitor/startApp.ts. This file is composed into the
 * shared store, so it must import nothing from src/mobile — that is how the
 * extension's content script stays free of Google code
 * (desktopHasNoGoogleCalendar.test.ts).
 */
export const createGoogleCalendarSlice: AppSlice<GoogleCalendarSlice> = (set) => ({
  gcal: {
    available: false,
    connected: false,
    email: null,
    syncing: false,
    progress: null,
    lastSyncAt: null,
    notice: null,
  },
  setGcal: (patch) => set((s) => ({ gcal: { ...s.gcal, ...patch } })),
});
