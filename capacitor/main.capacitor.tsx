// MUST be first: installs the Capacitor host before anything reads it.
import './installCapacitorPlatform';

import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
// Static on purpose, unlike the `@/entrypoints/main/main` import below: that
// module renders the React root on evaluation, which is why IT stays dynamic
// (see the comment in startApp). A stylesheet has no such side effect — it
// only affects paint — so importing it here up front is safe, and it is the
// only way LoginGate (rendered before startApp ever runs) gets styled at all.
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
import { resolveNativeEduroamSupport } from '@/mobile/eduroamNative';
import { installMobileActionHandler } from '@/mobile/actionHandler';
import { installExternalLinkHandler } from '@/mobile/openExternal';
import { promptSessionRecovery } from '@/mobile/sessionRecovery';
import { purgePlaintextToken, loadStoredToken, clearStoredToken } from '@/platform/tokenStore';
import { setSessionExpiredHandler } from '@/services/sessionExpiry';
import { setDemoErrorHandler } from '@/utils/reportError';
import { handleDemoError } from '@/mobile/demoToast';
import { useAppStore } from '@/store/useAppStore';
import { LoginGate } from '@/components/mobile/LoginGate';
import { BootErrorScreen } from '@/components/mobile/BootErrorScreen';

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

/**
 * The pre-app React root: the sign-in gate, or the boot-failure screen.
 *
 * Tracked in a module variable because BOTH of them can be on screen when the
 * other needs to render — the gate's own sign-in can fail, and a failure screen
 * can be replaced by a retry — and mounting a second root over a live one is
 * how you get two trees fighting over `#root`. Cleared (not just unmounted)
 * before `startApp`, whose own entry module mounts the real app here.
 *
 * It mounts into a CHILD of `#root` rather than into `#root` itself. The app's
 * entry (`entrypoints/main/main`) calls `createRoot(#root)` at module scope and
 * exports nothing, so once it has run there is a root on that container that
 * this file cannot reach, let alone unmount. Rendering the failure screen onto
 * the same container would leave the two of them writing to one node; a fresh
 * child is a container React has never seen, and emptying `#root` first takes
 * the dead tree's DOM away with it.
 */
let preAppRoot: Root | null = null;
let preAppHost: HTMLElement | null = null;

/**
 * The bare-DOM last resort: the old behaviour, kept for when React is the thing
 * that is broken.
 *
 * Untranslated and unstyled on purpose. It runs only where the alternative is a
 * blank page, and `String(e)` is the one piece of information a student can
 * read back to us — reIS transmits nothing about a failure.
 */
function showRawFatalText(e: unknown): void {
  const container = document.getElementById('root');
  if (!container) return;
  // Takes `preAppHost` with it. Nothing is unmounted here: this can run from
  // inside React's own error handling, and re-entering it to tear a root down
  // is how a recovery path becomes the next crash. A React root left rendering
  // into a detached node is harmless; a blank screen is not.
  container.textContent = `reIS failed to start: ${String(e)}`;
  preAppRoot = null;
  preAppHost = null;
}

function renderPreApp(node: ReactNode): void {
  unmountPreApp();
  const container = document.getElementById('root')!;
  container.replaceChildren();
  preAppHost = document.createElement('div');
  container.appendChild(preAppHost);
  preAppRoot = createRoot(preAppHost, {
    /**
     * `render()` schedules; it does not throw. So a component that fails —
     * `BootErrorScreen` itself, or the `useTranslation` under it reading a
     * store that is part of why boot failed — lands nowhere near the
     * `try/catch` around the call, and the screen whose entire job is to stop
     * a blank page would leave one. React 19's root callback is the boundary
     * that actually covers it. Raised in review on this PR.
     */
    onUncaughtError: (error) => showRawFatalText(error),
  });
  preAppRoot.render(node);
}

function unmountPreApp(): void {
  preAppRoot?.unmount();
  preAppRoot = null;
  preAppHost?.remove();
  preAppHost = null;
}

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

/**
 * The last-resort screen.
 *
 * Shared by boot() and by the gate's own handlers rather than written twice:
 * once the gate has unmounted there is no React tree left, so a rejection with
 * no handler leaves a blank screen — which is the failure this whole screen
 * exists to remove.
 *
 * It used to write `reIS failed to start: ${String(e)}` straight into #root and
 * stop there: untranslated, unstyled, and with nothing to tap. A student
 * photographed one and had to kill the app. `BootErrorScreen` says the same
 * thing with a retry and the demo attached — see the note there.
 *
 * `showRawFatalText` survives as the fallback beneath it: if React itself is
 * what failed, rendering a React screen about it would leave the blank page
 * this replaced. Two routes reach it — a throw from setting the root up, and
 * `onUncaughtError` for a component that fails while rendering.
 */
function showFatalError(e: unknown): void {
  try {
    renderPreApp(
      <BootErrorScreen
        detail={String(e)}
        // A full reload re-runs boot() from the top, which is the only honest
        // retry: whatever failed may have been the token read, the session
        // probe or the login itself, and each of them is upstream of here.
        onRetry={() => window.location.reload()}
        // Only while the app has never mounted — see `appMounted`. Demo mode
        // lives in memory (`errors/demoMode`), so a reload cannot carry it
        // either; there is no honest demo route left once the entry module has
        // run, and offering a dead button is worse than offering one route.
        onDemo={
          appMounted
            ? undefined
            : () => {
                void (async () => {
                  await useAppStore.getState().enterDemo();
                  unmountPreApp();
                  await startApp({ demo: true });
                })().catch(showFatalError);
              }
        }
      />
    );
  } catch {
    // Setting the root up failed — a missing container, or React refusing to
    // create a root at all. Render-time failures take the `onUncaughtError`
    // route above instead; both end here.
    showRawFatalText(e);
  }
}

// Exported for startApp.test.ts to verify the pre-render theme fix directly,
// the same reason startApp itself is exported below.
export async function showLoginGate(): Promise<void> {
  // Reused rather than re-reading IndexedDB here: createThemeSlice.loadTheme
  // already does exactly this (read 'reis_theme', validate, fall back to
  // DEFAULT_THEME, set data-theme) and every other theme-sync path in the app
  // (BroadcastChannel listeners, THEME_UPDATE) goes through the same action —
  // a second copy of the validation would drift the day DEFAULT_THEME changes.
  // Calling it here is safe because it is idempotent: it only reads storage
  // and re-applies the attribute, and startApp's own boot sequence calls it
  // again once the real app mounts. Awaited so the gate never paints one
  // frame in DaisyUI's unthemed default before the real theme lands.
  await useAppStore.getState().loadTheme();

  renderPreApp(
    <LoginGate
      onSignIn={() => {
        void (async () => {
          await ensureSession(await buildInAppLoginDeps());
          unmountPreApp();
          await startApp({ demo: false });
        })().catch((e: unknown) => {
          // The same judgement boot() makes below, and for the same reason:
          // dismissing login is a choice, not a failure. It needs repeating
          // here because this is the SECOND dismissal — someone who reached
          // the gate by backing out once, tried the button, and backed out
          // again — and showFatalError would wipe #root, leaving a dead
          // string where a mounted gate and its demo button already are.
          // Nothing to re-render: root.unmount() above runs only after
          // ensureSession resolves, so the gate is still on screen.
          if (e instanceof LoginCancelledError) return;
          showFatalError(e);
        });
      }}
      onDemoStarted={() => {
        unmountPreApp();
        void startApp({ demo: true }).catch(showFatalError);
      }}
    />
  );
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
