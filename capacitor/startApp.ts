// Imported for its side effect, exactly as the entry does: this module is
// reachable from tests that do not go through `main.capacitor`, and
// `fetchWithAuth` reads `getPlatform().kind` to choose its transport. ES modules
// evaluate once, so the entry importing it first still decides the ordering.
import './installCapacitorPlatform';

import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { resolveNativeEduroamSupport } from '@/mobile/eduroamNative';
import { installMobileActionHandler } from '@/mobile/actionHandler';
import { installExternalLinkHandler } from '@/mobile/openExternal';
import { promptSessionRecovery } from '@/mobile/sessionRecovery';
import { setSessionExpiredHandler } from '@/services/sessionExpiry';
import { setDemoErrorHandler } from '@/utils/reportError';
import { handleDemoError } from '@/mobile/demoToast';
import { useAppStore } from '@/store/useAppStore';

/**
 * Whether `entrypoints/main/main` has been evaluated.
 *
 * A dynamic import runs a module once; the second `await import(...)` resolves
 * from cache and renders nothing. So after the app has mounted, "start the demo
 * from here" is a button that cannot work — it would unmount the failure screen
 * and leave a blank page. Past that point a reload is the only real recovery,
 * and the screen offers only that.
 */
let appMounted = false;

/** Read by the failure screen to decide whether a demo route still exists. */
export function hasAppMounted(): boolean {
  return appMounted;
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

  // Same inversion, same reason: logError is called from everywhere including
  // the content script, so demoToast — and through it sonner — must not be
  // reachable from it by a static import. The extension itself never enters
  // demo mode, so it registering nothing costs it nothing. (Demo mode is no
  // longer Capacitor-only, though: the deployed web preview registers the
  // same handler early, in dev/earlyDemoMode.ts, for the same reason.)
  setDemoErrorHandler(handleDemoError);

  // Before the root renders, for the same reason as hydrateWelcome below: the
  // welcome screen's eduroam card and the eduroam sheet both read the answer
  // synchronously while rendering, and only the native half knows it. On a Mac
  // it is what turns the one-tap card into the profile download that macOS can
  // actually install. Never throws — see resolveNativeEduroamSupport.
  await resolveNativeEduroamSupport();

  // Before the root renders, so the first frame is already either the welcome
  // or the app — never the app with the welcome flashing over it a tick later.
  await useAppStore.getState().hydrateWelcome({ demo });
  // Beside it, so the calendar's first frame already knows whether to teach the
  // pull. A failed read leaves it null, which simply never plays the hint.
  await useAppStore
    .getState()
    .hydratePullHint({ demo })
    .catch(() => {});

  // Dynamic import on purpose: this module renders the React root on
  // evaluation, so a static import would boot the app BEFORE a session exists
  // and every sync request would fail its auth check.
  await import('@/entrypoints/main/main');
  appMounted = true;
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
