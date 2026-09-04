import { useAppStore } from '../src/store/useAppStore';
import { logError } from '../src/utils/reportError';
import type { HarnessEnv } from './harnessEnabled';

/**
 * Whether to put the app into demo mode at boot.
 *
 * Preview builds only. A local `dev:web` run must never do this: it reads the
 * real scraped snapshot, and `enterDemo()` calls `wipeSeeded()` on the way IN,
 * so booting demo locally would delete a developer's real data.
 */
export function shouldBootDemoMode(env: HarnessEnv): boolean {
  return env.VITE_PREVIEW_BUILD === 'true';
}

/**
 * Puts the deployed preview into the app's own demo mode.
 *
 * Not `VITE_USE_MOCK_DATA`: `initMockData()` only loads a dataset into
 * IndexedDB, leaving `handshakeDone` and `firstSyncSettled` false — every tab
 * then sits on a skeleton forever — and it defaults to the `esn` dataset, which
 * has no study plan or stats. `enterDemo()` loads `MOCK_REGISTRY.demo`, sets
 * those flags and a fabricated identity, and puts the store into the state that
 * makes `createContextSlice` skip the IS Mendelu fetch that a browser can only
 * answer with a CORS error anyway.
 *
 * `deps` exists so the decision and the call can be tested without a store.
 */
export async function bootDemoMode(
  env: HarnessEnv,
  deps: { enterDemo: () => Promise<void> } = {
    enterDemo: () => useAppStore.getState().enterDemo(),
  }
): Promise<void> {
  if (!shouldBootDemoMode(env)) return;
  try {
    await deps.enterDemo();
  } catch (err) {
    // A failed demo boot must not take the page down with it — the shell and
    // the preview banner should still render so the failure is visible.
    logError('bootDemoMode.enterDemo', err);
  }
}
