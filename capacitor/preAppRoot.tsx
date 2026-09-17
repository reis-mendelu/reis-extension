import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

/**
 * The React root that owns `#root` BEFORE the app does: the sign-in gate, or
 * the boot-failure screen.
 *
 * Its own module because the lifecycle is subtle and has nothing to do with the
 * boot sequence that drives it — `bootScreens` decides WHAT to show and this
 * decides how a screen can safely replace whatever is already there.
 *
 * The root is tracked in module state because BOTH screens can be on display
 * when the other needs to render — the gate's own sign-in can fail, and a
 * failure screen can be replaced by a retry — and mounting a second root over a
 * live one is how you get two trees fighting over one node.
 *
 * It mounts into a CHILD of `#root` rather than into `#root` itself. The app's
 * entry (`entrypoints/main/main`) calls `createRoot(#root)` at module scope and
 * exports nothing, so once it has run there is a root on that container nothing
 * here can reach, let alone unmount. Rendering onto the same container would
 * leave the two of them writing to one node; a fresh child is a container React
 * has never seen, and emptying `#root` first takes the dead tree's DOM with it.
 */
let preAppRoot: Root | null = null;
let preAppHost: HTMLElement | null = null;

/**
 * The bare-DOM last resort: the original behaviour, kept for when React is the
 * thing that is broken.
 *
 * Untranslated and unstyled on purpose. It runs only where the alternative is a
 * blank page, and `String(e)` is the one piece of information a student can
 * read back to us — reIS transmits nothing about a failure.
 */
export function showRawFatalText(e: unknown): void {
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

export function renderPreApp(node: ReactNode): void {
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

export function unmountPreApp(): void {
  preAppRoot?.unmount();
  preAppRoot = null;
  preAppHost?.remove();
  preAppHost = null;
}
