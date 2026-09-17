import { LoginGate } from '@/components/mobile/LoginGate';
import { BootErrorScreen } from '@/components/mobile/BootErrorScreen';
import { ensureSession, LoginCancelledError } from '@/mobile/ensureSession';
import { buildInAppLoginDeps } from '@/mobile/inAppLoginDeps';
import { useAppStore } from '@/store/useAppStore';
import { renderPreApp, unmountPreApp, showRawFatalText } from './preAppRoot';
import { startApp, hasAppMounted } from './startApp';

/**
 * The two screens the app can show INSTEAD of itself: the sign-in gate, and the
 * one that says boot failed.
 *
 * Split out of the entry, which had grown past 350 lines holding the boot
 * sequence, the recovery paths and the React-root lifecycle at once. The entry
 * keeps the order of operations; this keeps what a student is shown when that
 * order cannot be completed.
 */

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
export function showFatalError(e: unknown): void {
  try {
    renderPreApp(
      <BootErrorScreen
        detail={String(e)}
        // A full reload re-runs boot() from the top, which is the only honest
        // retry: whatever failed may have been the token read, the session
        // probe or the login itself, and each of them is upstream of here.
        onRetry={() => window.location.reload()}
        // Only while the app has never mounted — see `hasAppMounted`. Demo mode
        // lives in memory (`errors/demoMode`), so a reload cannot carry it
        // either; there is no honest demo route left once the entry module has
        // run, and offering a dead button is worse than offering one route.
        onDemo={
          hasAppMounted()
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
