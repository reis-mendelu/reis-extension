import { useAppStore } from '../src/store/useAppStore';
import { logError } from '../src/utils/reportError';
import { isPreviewBuild, type HarnessEnv } from '../src/utils/harnessEnabled';

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
 * Re-reads the IndexedDB stores `enterDemo()` just seeded back into the
 * Zustand store.
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
 * answer with a CORS error anyway. `refreshDemoData()` (see above) is what
 * actually gets the seeded data from IndexedDB onto the screen.
 *
 * `deps` exists so the decision and the calls can be tested without a store.
 */
export async function bootDemoMode(
  env: HarnessEnv,
  deps: { enterDemo: () => Promise<void>; refresh: () => Promise<void> } = {
    enterDemo: () => useAppStore.getState().enterDemo(),
    refresh: refreshDemoData,
  }
): Promise<void> {
  if (!shouldBootDemoMode(env)) return;
  try {
    await deps.enterDemo();
    await deps.refresh();
  } catch (err) {
    // A failed demo boot must not take the page down with it — the shell and
    // the preview banner should still render so the failure is visible.
    logError('bootDemoMode.enterDemo', err);
  }
}
