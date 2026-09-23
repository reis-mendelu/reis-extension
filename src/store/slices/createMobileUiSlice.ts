import type { AppSlice, MobileUiSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { clampRailWidth, RAIL_PX } from '../../utils/mapRail';

/**
 * Navigational state for the phone UI: which tab, which day, and the sheet
 * stack. A stack rather than a flag because the prototype genuinely nests
 * (Student → person, Subjects → drawer → confirm), and it gives Android
 * back-button handling for free later.
 *
 * Purely-local disclosure state (which accordion is open) deliberately stays
 * in component useState — this slice is for state that crosses components.
 */
export const createMobileUiSlice: AppSlice<MobileUiSlice> = (set, get) => ({
  mobileTab: 'calendar',
  mobileSelectedDayIso: null,
  mobileSheets: [],
  // Opens at the PEEK stop.
  //
  // It was 'half' — 45vh, 365px of a 375x812 phone — chosen when the Mapa tab
  // was a place to browse society events and the map was scenery. It is now
  // also how a student gets to a lecture, and at 'half' the sheet covered the
  // bottom of every route drawn under it while showing, in the measured case,
  // one 60px event row above 270px of nothing.
  //
  // Peek returns 199px — a quarter of the screen — and takes the unobstructed
  // map from 47% to 72%. The reason 'half' was chosen still holds and is still
  // one tap away: the peek row names what is underneath and expands on touch.
  mapSheetState: 'peek',
  mapRailWidth: RAIL_PX,
  mapRailOpen: true,
  devPhoneOverride: null,
  welcomeSeen: null,
  externalOpening: false,
  pullHintSeen: null,

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

  // Read once at boot beside the welcome flag. Demo mode counts as seen: a
  // pull there answers "not available in demo", so teaching it teaches a dead
  // end — and the reviewer's first screen should not move on its own.
  hydratePullHint: async ({ demo }) => {
    if (demo) {
      set({ pullHintSeen: true });
      return;
    }
    const seen = await IndexedDBService.get('meta', 'pull_hint_seen');
    set({ pullHintSeen: seen === true });
  },
  // Once, ever: marked when the hint plays, or when the student pulls first.
  markPullHintSeen: () => {
    if (get().pullHintSeen === true) return;
    set({ pullHintSeen: true });
    IndexedDBService.set('meta', 'pull_hint_seen', true).catch(() => {});
  },

  // Switching tabs closes sheets: a sheet belongs to the screen that opened it.
  setMobileTab: (tab) => {
    // And leaving the map drops the lesson's route offer, which belongs to one
    // arrival from the timetable rather than to the room it points at —
    // otherwise coming back for something else re-asks "Najdi cestu" about a
    // room the student already walked away from.
    //
    // Here rather than as an unmount cleanup in MapScreen, which is what it
    // looks like it should be: this app runs under StrictMode, so effects are
    // double-invoked and that cleanup ran milliseconds after the pin set the
    // suggestion. The chip never appeared at all.
    set({ mobileTab: tab, mobileSheets: [], ...(tab === 'map' ? {} : { routeSuggestion: null }) });
    // A file opened from the Subjects tab should be in the calendar's
    // "recently opened" strip by the time the student gets there.
    if (tab === 'calendar') void get().refreshRecentPdfs();
    // Exams are fetched fresh on every visit: registration moves by the minute,
    // and a list that could be an hour old is the one screen where that costs a
    // student a slot. Exam terms only (~0.6s), never the full crawl, and the
    // refresh is visible — the list holds down with the spinner until it
    // answers. Not in demo, where it could only say "not available".
    if (tab === 'exams' && !get().demoMode) get().triggerExamsRefresh();
  },
  setMobileSelectedDay: (iso) => set({ mobileSelectedDayIso: iso }),

  setExternalOpening: (opening) => set({ externalOpening: opening }),

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
  // Clamped on the way IN, so nothing downstream — the rail's own width, the
  // camera offset that halves it — ever has to re-check.
  setMapRailWidth: (px) => set({ mapRailWidth: clampRailWidth(px, window.innerWidth) }),
  setMapRailOpen: (open) => set({ mapRailOpen: open }),

  setDevPhoneOverride: (value) => set({ devPhoneOverride: value }),
});
