import { create } from 'zustand';
import type { AppState } from './types';
import { watchSignedInStudent } from '../services/identity/watchSignedInStudent';
import { createScheduleSlice } from './slices/createScheduleSlice';
import { createExamSlice } from './slices/createExamSlice';
import { createSyllabusSlice } from './slices/createSyllabusSlice';
import { createZaznamnikSlice } from './slices/createZaznamnikSlice';
import { createFilesSlice } from './slices/createFilesSlice';
import { createNotesSlice } from './slices/createNotesSlice';
import { createClassmatesSlice } from './slices/createClassmatesSlice';
import { createSubjectsSlice } from './slices/createSubjectsSlice';
import { createSyncSlice } from './slices/createSyncSlice';
import { createThemeSlice } from './slices/createThemeSlice';
import { createI18nSlice } from './slices/createI18nSlice';
import { createSuccessRateSlice } from './slices/createSuccessRateSlice';
import { createEduroamSlice } from './slices/createEduroamSlice';
import { createDocumentsSlice } from './slices/createDocumentsSlice';
import { createFeedbackSlice } from './slices/createFeedbackSlice';
import { createStudyPlanSlice } from './slices/createStudyPlanSlice';
import { createCvicneTestsSlice } from './slices/createCvicneTestsSlice';
import { createErasmusSlice } from './slices/createErasmusSlice';
import { createMenuSlice } from './slices/createMenuSlice';
import { createHiddenItemsSlice } from './slices/createHiddenItemsSlice';
import { createTeachingWeekSlice } from './slices/createTeachingWeekSlice';
import { createNavPagesSlice } from './slices/createNavPagesSlice';
import { createContextSlice } from './slices/createContextSlice';
import { createPulseSlice } from './slices/createPulseSlice';
import { createCustomEventsSlice } from './slices/createCustomEventsSlice';
import { createNotificationSlice } from './slices/createNotificationSlice';
import { createSearchSlice } from './slices/createSearchSlice';
import { createRecentPdfsSlice } from './slices/createRecentPdfsSlice';
import { createPersonProfileSlice } from './slices/createPersonProfileSlice';
import { createBulletinSlice } from './slices/createBulletinSlice';
import { createViewportSlice } from './slices/createViewportSlice';
import { createMobileUiSlice } from './slices/createMobileUiSlice';
import { createMapSlice } from './slices/createMapSlice';
import { createRsvpSlice } from './slices/createRsvpSlice';
import { createAdminSlice } from './slices/createAdminSlice';
import { createAdminStatsSlice } from './slices/createAdminStatsSlice';
import { createSuggestionsSlice } from './slices/createSuggestionsSlice';
import { createDemoSlice } from './slices/createDemoSlice';
import { createRouteSlice } from './slices/createRouteSlice';
import { syncService } from '../services/sync';
import { initMockData } from '../utils/initMockData';
import { resetRealDataStores } from '../services/loadRealDataSnapshot';
import { devAdminSeed } from '../utils/mock/devSociety';
import type { Session } from '@supabase/supabase-js';
import { FILES_SYNC_CHANNEL, type FilesSyncMessage } from './slices/files/broadcastFilesSync';
import { setDemoModeFlag, isDemoMode } from '../errors/demoMode';

export const useAppStore = create<AppState>()((...a) => ({
  ...createScheduleSlice(...a),
  ...createExamSlice(...a),
  ...createSyllabusSlice(...a),
  ...createZaznamnikSlice(...a),
  ...createFilesSlice(...a),
  ...createNotesSlice(...a),
  ...createClassmatesSlice(...a),
  ...createSubjectsSlice(...a),
  ...createSyncSlice(...a),
  ...createThemeSlice(...a),
  ...createI18nSlice(...a),
  ...createSuccessRateSlice(...a),
  ...createEduroamSlice(...a),
  ...createDocumentsSlice(...a),
  ...createFeedbackSlice(...a),
  ...createStudyPlanSlice(...a),
  ...createCvicneTestsSlice(...a),
  ...createErasmusSlice(...a),
  ...createMenuSlice(...a),
  ...createHiddenItemsSlice(...a),
  ...createTeachingWeekSlice(...a),
  ...createNavPagesSlice(...a),
  ...createContextSlice(...a),
  ...createPulseSlice(...a),
  ...createCustomEventsSlice(...a),
  ...createNotificationSlice(...a),
  ...createSearchSlice(...a),
  ...createRecentPdfsSlice(...a),
  ...createPersonProfileSlice(...a),
  ...createBulletinSlice(...a),
  ...createViewportSlice(...a),
  ...createMobileUiSlice(...a),
  ...createMapSlice(...a),
  ...createRsvpSlice(...a),
  ...createAdminSlice(...a),
  ...createAdminStatsSlice(...a),
  ...createSuggestionsSlice(...a),
  ...createRouteSlice(...a),
  ...createDemoSlice(...a),
}));

// Initialize store and subscribe to sync updates
export const initializeStore = async () => {
  // Initialize mock data for demo if enabled
  // Set USE_MOCK_DATA=true in your .env file to enable
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
    await initMockData();
  } else {
    // Dev standalone real-data mode: wipe crawl data left in IDB by a previous
    // mock session BEFORE the tier-1 hydration below reads it, so the snapshot
    // is the sole source of truth. No-op in production / inside the iframe.
    //
    // `import.meta.env.DEV` and not the wider harness predicate: this uses the
    // DEFAULT url, the raw `/dev-real-data.json`, which is right for
    // `npm run dev:web` and wrong for a built preview — there the raw scrape is
    // deleted from the output, and dev/bootDemoMode.ts already calls
    // resetRealDataStores('/preview-data.json') with the sanitised file.
    // `npm run check:app` fails the build if this asks for the raw scrape.
    if (import.meta.env.DEV) await resetRealDataStores();
  }

  const s = useAppStore.getState();

  // Who is signed in is confirmed against IS once per session, and the app
  // restarts if it turns out to be somebody else — see watchSignedInStudent.
  //
  // Not in demo mode. `fetchWithAuth` would refuse the request anyway
  // (DemoModeError), but asking at all means a logged failure on every demo
  // boot, and demo mode is the build a store reviewer runs — the one boot that
  // is supposed to reach nothing.
  const demo = import.meta.env.VITE_USE_MOCK_DATA === 'true' || isDemoMode();
  const offIdentityWatch = demo ? () => {} : watchSignedInStudent();

  // Start global pulse
  const pulseInterval = setInterval(() => {
    useAppStore.getState().updatePulse();
  }, 1000);

  // Tier 1: User-visible data — load immediately
  s.loadNotificationState();
  s.loadPreferredMapApp();
  s.fetchNotifications();
  s.fetchSchedule();
  s.fetchExams();
  s.fetchSubjects();
  s.loadTheme();
  // The promise is kept, not discarded: the jídelníček below is scraped per
  // language from two different SKM pages, so a request that beats the stored
  // language into the store would fetch the Czech page for an English student
  // — and then the store's own guard (`if (get().menu) return`) would block
  // the correction forever.
  const languageReady = s.loadLanguage();
  s.loadContext();
  const devSeed = devAdminSeed();
  if (devSeed) {
    // Dev-only: seed a persistent society/admin session so the organizer and
    // reIS-admin surfaces are available at localhost:3000 without a Supabase
    // login on every reload. Stripped from production by import.meta.env.DEV.
    useAppStore.setState({
      // Role comes from the seed rather than being hardcoded to 'association':
      // the reIS-admin surfaces (the suggestions inbox) only appear for
      // 'reis_admin', so a fixed role made them unreachable in the dev webapp.
      adminRole: devSeed.adminRole,
      adminAssociationId: devSeed.adminAssociationId,
      adminActiveAssociationId: devSeed.adminAssociationId,
      adminSession: { user: { email: devSeed.email } } as unknown as Session,
    });
    if (devSeed.adminRole === 'reis_admin') void s.loadSuggestions();
    void s.loadSocietyPosts();
  } else {
    s.loadAdminSession();
  }

  // Tier 2: Background data — deferred to avoid thundering-herd on IDB at startup
  queueMicrotask(async () => {
    const s2 = useAppStore.getState();
    s2.fetchStudyPlan();
    s2.fetchStudyStats();
    s2.fetchStudyComparison();
    s2.loadGradeHistory();
    s2.fetchCvicneTests();
    s2.fetchOdevzdavarny();
    s2.fetchAllFiles();
    s2.fetchAllClassmates();
    await s2.hydrateLastFilesFetchedAt();
    await s2.hydrateLastClassmatesFetchedAt();
    await s2.hydrateLastExamClassmatesFetchedAt();
    s2.fetchZaznamnik();
    s2.loadFeedbackState();
    s2.loadHiddenItems();
    s2.loadCalendarCustomEvents();
    s2.fetchTeachingWeek();
    s2.loadRecentSearches();
    s2.refreshRecentPdfs();
    s2.hydrateBulletin();
    s2.loadMapEvents();
    // The jídelníček. It used to be fetched from a useEffect in each of the
    // three components that show it (the weekly header, its popover, the
    // phone's MenuCard) — three triggers for one request, and an Iron Rule
    // violation. App.tsx runs useAppLogic() above the phone/desktop branch, so
    // this one call covers both trees. The store owns the request guard, so a
    // menu already in hand is not re-fetched.
    //
    // No `.catch`, and that is load-bearing rather than an oversight:
    // `loadLanguage` catches its own failure and falls back to the default, so
    // this promise always resolves, and `fetchMenu` swallows a failed request
    // into `menuError`. Neither half can reject. If either ever grows a throw,
    // this needs a catch — an unhandled rejection at boot is how the whole
    // tier-2 block stops running.
    void languageReady.then(() => useAppStore.getState().fetchMenu());
    // Predictive prefetch — files for subjects scheduled today.
    // Guarded by 60s SWR + max 6 subjects in prefetchTodaySubjectsImpl.
    useAppStore.getState().prefetchTodaySubjects();
  });

  // Fire-and-forget daily usage tracking. The row is still keyed on a random
  // install id, never the student's identity; since September 2026 it also
  // carries two GROUP labels (faculty, platform) read via getUserParams()/
  // getPlatform() — see the comment on trackDailyUsage.
  // getPlatform() can throw during boot ordering; caught here so a fire-and-
  // forget call can never surface as an unhandled rejection.
  import('../api/feedback').then(({ trackDailyUsage }) => trackDailyUsage()).catch(() => {});

  // Subscribe to sync service — selective refresh based on type
  const unsubscribe = syncService.subscribe((type) => {
    const st = useAppStore.getState();

    if (type === 'THEME_UPDATE') {
      st.loadTheme();
      return;
    }
    if (type === 'LANGUAGE_UPDATE') {
      st.loadLanguage().then(() => useAppStore.getState().loadMapEvents());
      st.fetchAllFiles();
      // Clear THEN ask: clearing is what reopens the store's request guard,
      // and the ask is what used to come from a component effect noticing the
      // null. Nothing watches `menu` for that any more.
      useAppStore.setState({ menu: null });
      void useAppStore.getState().fetchMenu();
      return;
    }

    // Default: full data refresh (e.g. after sync completes)
    // Chain prefetch after schedule resolves so a fresh install (empty IDB
    // schedule at init) still gets predictive prefetch on the first sync.
    st.fetchSchedule().then(() => useAppStore.getState().prefetchTodaySubjects());
    st.fetchExams();
    st.fetchSubjects();
    st.fetchStudyPlan();
    st.fetchStudyStats();
    st.fetchStudyComparison();
    st.loadGradeHistory();
    st.fetchCvicneTests();
    st.fetchOdevzdavarny();
  });

  // Cross-tab theme listener — use loadTheme() to also update DOM data-theme attribute
  const bcTheme = new BroadcastChannel('reis_theme_sync');
  bcTheme.onmessage = () => {
    useAppStore.getState().loadTheme();
  };

  // Cross-tab language listener — use loadLanguage() and re-fetch files for the new language
  const bcLang = new BroadcastChannel('reis_language_sync');
  bcLang.onmessage = () => {
    // Chained, where the LANGUAGE_UPDATE handler above is not, and the
    // difference is real rather than stylistic: there, `setLanguage` has
    // already written the new language into THIS tab's store synchronously
    // before triggering. Here the writing tab was a different one, so this
    // tab still holds the old language until `loadLanguage()` reads it back
    // out of IDB — and a menu request fired before that resolves asks
    // skm.mendelu.cz for the page the student just left.
    const languageReady = useAppStore.getState().loadLanguage();
    void languageReady.then(() => useAppStore.getState().loadMapEvents());
    useAppStore.getState().fetchAllFiles();
    // Clear menu so it re-fetches with the new language
    useAppStore.setState({ menu: null });
    void languageReady.then(() => useAppStore.getState().fetchMenu());
  };

  // Cross-iframe files listener — when another window refreshes a subject's
  // files, rehydrate from IDB and advance lastFilesFetchedAt without re-fetching.
  const bcFiles = new BroadcastChannel(FILES_SYNC_CHANNEL);
  bcFiles.onmessage = (event) => {
    const msg = event.data as FilesSyncMessage | undefined;
    if (!msg?.courseCode) return;
    useAppStore.setState((s) => ({
      lastFilesFetchedAt: { ...s.lastFilesFetchedAt, [msg.courseCode]: msg.fetchedAt },
    }));
    void useAppStore.getState().refreshFiles(msg.courseCode);
  };

  return () => {
    clearInterval(pulseInterval);
    offIdentityWatch();
    unsubscribe();
    bcTheme.close();
    bcLang.close();
    bcFiles.close();
  };
};

// Keeps the store the single source of truth for demo mode while letting the
// network guards read it without importing this module — see errors/demoMode.
// Subscribing rather than writing from the slice means `setState({ demoMode })`
// in a test propagates too.
useAppStore.subscribe((state) => setDemoModeFlag(state.demoMode));
