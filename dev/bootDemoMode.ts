import { useAppStore } from '../src/store/useAppStore';
import { logError } from '../src/utils/reportError';
import { isPreviewBuild, type HarnessEnv } from '../src/utils/harnessEnabled';
import { loadRealDataSnapshot, resetRealDataStores } from '../src/services/loadRealDataSnapshot';

/**
 * Whether to put the app into demo mode at boot.
 *
 * Preview builds only. A local `dev:web` run must never do this: it reads the
 * real scraped snapshot, and `enterDemo()` calls `wipeSeeded()` on the way IN,
 * so booting demo locally would delete a developer's real data.
 *
 * Delegates to `isPreviewBuild` (zero-dependency, in `harnessEnabled.ts`) so
 * this predicate and `earlyDemoMode.ts`'s can never disagree about what
 * "preview build" means.
 */
export function shouldBootDemoMode(env: HarnessEnv): boolean {
  return isPreviewBuild(env);
}

/**
 * The sanitised snapshot — never the raw `dev-real-data.json`.
 *
 * Exported so `main.web.tsx` can re-fetch the same file for `mountSnapshotAge`
 * without a second literal to drift out of sync with this one.
 */
export const PREVIEW_DATA_URL = '/preview-data.json';

/**
 * Whether this build loads Dominik's real snapshot instead of the demo dataset.
 *
 * Requires BOTH flags. The preview-build flag alone must not be enough: a stray
 * VITE_PREVIEW_DATA in a local .env would otherwise make `dev:web` fetch a file
 * that is not there and render nothing.
 */
export function shouldLoadRealData(env: HarnessEnv & { VITE_PREVIEW_DATA?: string }): boolean {
  return isPreviewBuild(env) && env.VITE_PREVIEW_DATA === 'real';
}

/**
 * Re-reads the IndexedDB stores `enterDemo()` just seeded back into the
 * Zustand store.
 *
 * Demo-branch only. On the real-data branch the snapshot's own
 * `REIS_SYNC_UPDATE` handler is what populates the store — this function is
 * never called there, and must not be: `loadRealDataSnapshot()` resolves as
 * soon as `window.postMessage` returns, before that handler has necessarily
 * run, so calling this immediately afterward would read whatever is
 * *currently* in IndexedDB (possibly nothing yet) and publish it as
 * `status: 'success'`.
 *
 * `MockManager.loadDataset` (called by `enterDemo`) writes ONLY to IndexedDB —
 * `exams`, `schedule`, `study_plan`, and the `study_stats` / `study_comparison`
 * keys in `meta` — it never touches the store directly. Those same stores are
 * also read once, into the store, during the app's own boot
 * (`useAppStore.ts`'s init function and its Tier-2 `queueMicrotask`), which
 * runs BEFORE this module's `bootDemoMode()` call even fires: ES module
 * side effects execute in import order, and `@/entrypoints/main/main` is
 * imported well before `./bootDemoMode` in `main.web.tsx`. On a completely
 * fresh visitor — an empty IndexedDB, which is every real preview visit — that
 * first read sees nothing, and nothing re-reads afterward. The result: the
 * schedule, exams and study-plan screens sat on their EMPTY state forever,
 * not a skeleton, so it did not trip the "no skeleton" check, but it is the
 * same "does not render demo content" failure by another name. Verified in a
 * browser against a never-before-visited origin, first load, no reload.
 *
 * `subjects` is deliberately not re-fetched: `MockManager` never seeds that
 * store (the Subjects screen reads `studyPlanDual` via `fetchStudyPlan`
 * instead), so re-reading it would be a no-op.
 */
async function refreshDemoData(): Promise<void> {
  const s = useAppStore.getState();
  await Promise.all([
    s.fetchSchedule(),
    s.fetchExams(),
    s.fetchStudyPlan(),
    s.fetchStudyStats(),
    s.fetchStudyComparison(),
  ]);
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
 * answer with a CORS error anyway. On THIS branch, `refreshDemoData()` (see
 * above) is what actually gets the seeded data from IndexedDB onto the screen
 * — the real-data branch below gets there a different way.
 *
 * `deps` exists so the decision and the calls can be tested without a store.
 */
export async function bootDemoMode(
  env: HarnessEnv & { VITE_PREVIEW_DATA?: string },
  deps: {
    enterDemo: () => Promise<void>;
    refresh: () => Promise<void>;
    loadSnapshot: (url: string) => Promise<boolean>;
    resetRealDataStores: (url: string) => Promise<boolean>;
  } = {
    enterDemo: () => useAppStore.getState().enterDemo(),
    refresh: refreshDemoData,
    loadSnapshot: (url: string) => loadRealDataSnapshot(url),
    resetRealDataStores: (url: string) => resetRealDataStores(url),
  }
): Promise<void> {
  if (!shouldBootDemoMode(env)) return;
  try {
    if (shouldLoadRealData(env)) {
      // Demo mode is already ON (dev/earlyDemoMode.ts set the flag before the
      // app booted) and stays on — here it means "offline", not "fake". That is
      // what keeps createContextSlice from calling IS Mendelu and feedback.ts
      // from writing track_daily_usage. Only the data source differs.
      //
      // Clear stale IndexedDB stores BEFORE requesting the snapshot: a store
      // the snapshot omits must end up empty, not carrying over content from
      // an earlier demo/mock session on the same origin.
      await deps.resetRealDataStores(PREVIEW_DATA_URL);
      await deps.loadSnapshot(PREVIEW_DATA_URL);
      // No deps.refresh() here. loadSnapshot() (loadRealDataSnapshot) resolves
      // as soon as window.postMessage RETURNS — delivery of REIS_SYNC_UPDATE
      // is a queued task, not a microtask — so the snapshot's own message
      // handler has not necessarily written anything yet. Calling refresh()
      // here would read IndexedDB before that handler runs and briefly
      // publish an empty-but-"success" state; only the handler running
      // afterward is what actually populates the store on this path.
    } else {
      await deps.enterDemo();
      await deps.refresh();
    }
    return;
  } catch (err) {
    // A failed demo boot must not take the page down with it — the shell and
    // the preview banner should still render so the failure is visible.
    logError('bootDemoMode.enterDemo', err);
  }
}
