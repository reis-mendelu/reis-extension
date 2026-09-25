// MUST be first: installs the Capacitor host before anything reads it.
import './installCapacitorPlatform';

import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
// Static on purpose, unlike the `@/entrypoints/main/main` import inside
// `startApp`: that module renders the React root on evaluation, which is why IT
// stays dynamic. A stylesheet has no such side effect — it only affects paint —
// so importing it here up front is safe, and it is the only way LoginGate
// (rendered before startApp ever runs) gets styled at all.
// Keep this list identical to src/entrypoints/main/main.tsx lines 3-11; if
// that list changes, mirror it here too, or the gate silently regresses to
// unstyled again.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-ext-700.css';
import '@/index.css';
import { ensureSession, LoginCancelledError } from '@/mobile/ensureSession';
import { buildInAppLoginDeps } from '@/mobile/inAppLoginDeps';
import { discardDeadSession } from '@/mobile/verifySession';
import { fetchWithAuth, BASE_URL } from '@/api/client';
import { IndexedDBService } from '@/services/storage';
import { handleBackPress } from '@/mobile/backButton';
import { purgePlaintextToken, loadStoredToken, clearStoredToken } from '@/platform/tokenStore';
import { useAppStore } from '@/store/useAppStore';
import { startApp } from './startApp';
import { showLoginGate, showFatalError } from './bootScreens';
import { syncSystemBarsToTheme } from '@/mobile/systemBarsTheme';

// Android only: the status bar sits transparent over the app there (see
// MainActivity), so its icons must follow the reIS theme, not the system one.
// iOS is left on its current behaviour.
if (Capacitor.getPlatform() === 'android') {
  syncSystemBarsToTheme(document.documentElement, (style) => {
    void SystemBars.setStyle({
      style: style === 'DARK' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    });
  });
}

/**
 * Android's hardware back unwinds the sheet stack, then the tab, before
 * exiting. Registered before boot so it works even while the login WebView is
 * up — no tab exists then, and handleBackPress falls through to exit.
 */
void CapApp.addListener('backButton', () => {
  const s = useAppStore.getState();
  const result = handleBackPress({
    sheetCount: s.mobileSheets.length,
    popSheet: s.popSheet,
    bulletinOpen: s.bulletinExpanded,
    closeBulletin: () => void s.setBulletinExpanded(false),
    tab: s.mobileTab,
    goToCalendar: () => s.setMobileTab('calendar'),
  });
  if (result === 'exit') {
    void CapApp.exitApp();
  }
});

async function boot(): Promise<void> {
  // BEFORE ensureSession, which is what reads the token and decides whether to
  // present login. Installs from before #172 hold a live UISAuth in plain
  // Preferences; it is deleted rather than migrated, so the student signs in
  // once and the plaintext copy is gone by deletion rather than by trusting a
  // copy step.
  await purgePlaintextToken();

  // BEFORE ensureSession too, and for a related reason: ensureSession accepts
  // the stored token on SHAPE alone, and on iOS that token outlives the app —
  // the shared keychain group hands a reinstall the credential the previous
  // install left behind. IS stopped honouring it long ago, so login was never
  // presented and the student landed on the first-run welcome screen, whose
  // one-tap eduroam card is the first thing in the app to actually talk to IS.
  // It 401'd, and the "sign in?" prompt arrived AFTER the failure.
  //
  // `studium.pl` rather than a fresh endpoint: schedule.ts already GETs it on
  // every mobile sync, so it is proven to come back as authenticated HTML
  // through this exact transport. Nothing here throws, and only a real
  // authentication failure discards anything — see discardDeadSession.
  await discardDeadSession({
    getStored: () => loadStoredToken().catch(() => undefined),
    // Same key hydrateWelcome reads below. IndexedDB goes with the app
    // container, the keychain does not — so its absence beside a token is the
    // reinstall, and its presence means skip and keep the offline cold start.
    shouldVerify: async () => (await IndexedDBService.get('meta', 'welcome_dismissed')) !== true,
    probe: () => fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`),
    clear: () => clearStoredToken(),
  });

  // Same deps as re-login after a lapse (mobile/sessionRecovery), deliberately
  // shared: ensureSession's cookie-polling contract only holds if onPageLoaded
  // and readCookies come from the same WebView openLogin presented, and two
  // copies of that would drift.
  await ensureSession(await buildInAppLoginDeps());

  await startApp({ demo: false });
}

void boot().catch(async (e) => {
  // try/catch rather than `.catch()`: a throw HERE would abandon the handler
  // and leave the splash screen over a page with no error on it — the blank
  // screen this whole path exists to remove, reached by way of the handler for
  // it. The statement form also survives a `hide()` that returns no promise at
  // all, which is how the plugin behaves under a stub.
  try {
    await SplashScreen.hide();
  } catch {
    // Nothing to do about it, and nothing worth saying: the error below is the
    // one the student needs.
  }

  // Backing out of login is not a failure — it is the only path someone
  // without a MENDELU account has, App Store reviewers included. Anything
  // else keeps the old error text.
  if (e instanceof LoginCancelledError) {
    await showLoginGate();
    return;
  }

  showFatalError(e);
});
