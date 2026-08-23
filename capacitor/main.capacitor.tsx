// MUST be first: installs the Capacitor host before anything reads it.
import './installCapacitorPlatform';

import { createRoot } from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { ensureSession, LoginCancelledError } from '@/mobile/ensureSession';
import { buildInAppLoginDeps } from '@/mobile/inAppLoginDeps';
import { handleBackPress } from '@/mobile/backButton';
import { installMobileActionHandler } from '@/mobile/actionHandler';
import { installExternalLinkHandler } from '@/mobile/openExternal';
import { promptSessionRecovery } from '@/mobile/sessionRecovery';
import { purgePlaintextToken } from '@/platform/tokenStore';
import { setSessionExpiredHandler } from '@/services/sessionExpiry';
import { useAppStore } from '@/store/useAppStore';
import { LoginGate } from '@/components/mobile/LoginGate';

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

  // Same deps as re-login after a lapse (mobile/sessionRecovery), deliberately
  // shared: ensureSession's cookie-polling contract only holds if onPageLoaded
  // and readCookies come from the same WebView openLogin presented, and two
  // copies of that would drift.
  await ensureSession(await buildInAppLoginDeps());

  await startApp({ demo: false });
}

/**
 * Everything after a session exists — or after someone chose the demo.
 *
 * Extracted rather than duplicated for the demo path: the order below is
 * load-bearing and each step carries a comment saying why it sits where it
 * does. Two copies would drift on the first change.
 */
export async function startApp({ demo }: { demo: boolean }): Promise<void> {
  // Before the React root: the app posts REIS_ACTION as soon as it renders
  // (a watchdog exam refresh, a tapped download), and with no responder those
  // sit until the 30 s timeout. Installing first means none are missed.
  installMobileActionHandler();

  // Before the React root too: a target="_blank" link that slips through opens
  // in the SYSTEM BROWSER, which has no IS session, so the student lands on a
  // login page instead of their document. One document-level interceptor
  // covers every such link rather than an edit per call site — a list of these
  // has already gone stale three times in the plan.
  installExternalLinkHandler();

  // The sync reports a lapsed session through a registry it can depend on
  // without dragging this prompt into the extension's content script. Nothing
  // registers a handler there, so nothing happens there.
  setSessionExpiredHandler(promptSessionRecovery);

  // Dynamic import on purpose: this module renders the React root on
  // evaluation, so a static import would boot the app BEFORE a session exists
  // and every sync request would fail its auth check.
  await import('@/entrypoints/main/main');
  await SplashScreen.hide();

  // Demo data is seeded, static and complete. Syncing would only produce
  // failed IS requests, and fetchWithAuth throws DemoModeError anyway.
  if (demo) return;

  // In the extension the CONTENT SCRIPT drives this and posts results into the
  // iframe. Capacitor has neither, so the app drives its own sync; sendToIframe
  // loops the results back to this same window, where useAppLogic's existing
  // handler consumes them unchanged.
  // startSyncService fires an immediate boot sync and then sets the
  // SYNC_INTERVAL timer — no separate first call needed.
  const { requestSync, startSyncService } = await import('@/injector/syncGate');
  startSyncService();

  // IS's session is a sliding inactivity window, so a returning student is
  // usually still authenticated — refresh on resume rather than only at boot.
  //
  // Through the gate, not straight into syncAllData: unconditionally, this cost
  // a full ~120-request crawl every time the student tabbed away and back, even
  // for ten seconds. MIN_SYNC_GAP collapses those; a resume after a real
  // absence still syncs.
  void CapApp.addListener('resume', () => {
    void requestSync('resume');
  });
}

/** The sign-in gate, rendered without a session and without the app behind it. */
function showLoginGate(): void {
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <LoginGate
      onSignIn={() => {
        void (async () => {
          await ensureSession(await buildInAppLoginDeps());
          root.unmount();
          await startApp({ demo: false });
        })();
      }}
      onDemoStarted={() => {
        root.unmount();
        void startApp({ demo: true });
      }}
    />
  );
}

void boot().catch(async (e) => {
  await SplashScreen.hide();

  // Backing out of login is not a failure — it is the only path someone
  // without a MENDELU account has, App Store reviewers included. Anything
  // else keeps the old error text.
  if (e instanceof LoginCancelledError) {
    showLoginGate();
    return;
  }

  document.getElementById('root')!.textContent = `reIS failed to start: ${String(e)}`;
});
