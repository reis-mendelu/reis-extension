import type { AppSlice, DemoSlice } from '../types';
import { isDemoMode } from '../../errors/demoMode';
import { IndexedDBService } from '../../services/storage';
import { MockManager } from '../../utils/mock/MockManager';
import { MOCK_REGISTRY } from '../../utils/mock/registry';
import { demoContext } from '../../utils/mock/data/demo';

/**
 * IS-derived stores: everything a real sync would repopulate. Cleared on the
 * way into AND out of demo mode so a real student's own subjects/files/grades
 * never sit under the "Ukázka" banner, and demo fixtures never leak the other
 * way into a real session. This list is a fixed classification decision, not
 * "whatever the demo dataset happens to write" — see the two exclusions below
 * for what's deliberately left out and why.
 *
 * `success_rates` is IS-derived data the demo dataset *does* write, but it's
 * excluded here on purpose: it's public per-subject difficulty data from the
 * CDN, identical for every student, so wiping it only forces a needless
 * refetch with no privacy benefit.
 *
 * `erasmus` and `map_rooms` are also CDN reference data, not personal, and
 * were never in the demo's write set to begin with.
 *
 * `hidden_items`, `custom_events`, `document_notes`, `note_images`, and
 * `zaznamnik` are the student's own authored content — nothing re-syncs them,
 * so clearing would be data loss, not privacy protection. `meta` is handled
 * separately below (per-key, never store-wide).
 */
const IS_DERIVED_STORES = [
  'files',
  'assessments',
  'syllabuses',
  'exams',
  'schedule',
  'subjects',
  'classmates',
  'grade_history',
  'study_plan',
  'cvicne_tests',
  'odevzdavarny',
] as const;

/**
 * Keys inside `meta`, deleted individually.
 *
 * `meta` also holds the theme, the language and the crash-report opt-out, so
 * clearing the store to tidy up the demo would reset a student's privacy
 * choice. Delete by key or not at all.
 */
const IS_DERIVED_META_KEYS = ['study_stats', 'study_comparison'] as const;

async function wipeSeeded(): Promise<void> {
  for (const store of IS_DERIVED_STORES) {
    await IndexedDBService.clear(store);
  }
  for (const key of IS_DERIVED_META_KEYS) {
    await IndexedDBService.delete('meta', key);
  }
}

export const createDemoSlice: AppSlice<DemoSlice> = (set) => ({
  // Reads the module-level flag rather than hardcoding false: on the
  // deployed preview, dev/earlyDemoMode.ts calls setDemoModeFlag(true)
  // before this slice (and the store that owns it) ever evaluates. Several
  // guards — loadContext's `if (get().demoMode) return`, most notably — read
  // this store field directly rather than importing errors/demoMode, so
  // seeding it from the same source of truth at creation time is what keeps
  // them from firing a real IS Mendelu / Supabase call before enterDemo()
  // gets a chance to run. See useAppStore.ts's subscribe just below the
  // store definition for the other half of this: it keeps the flag in sync
  // with every later `set({ demoMode })`, this line only handles the very
  // first read.
  demoMode: isDemoMode(),

  enterDemo: async () => {
    // Wiping on the way IN as well as out: a student who signs out and then
    // pokes at the demo must not see their own leftovers presented as sample
    // data, and the reverse must not happen either.
    await wipeSeeded();
    await MockManager.loadDataset(MOCK_REGISTRY.demo!);

    // Load-bearing and easy to miss. The screens gate their content on
    // handshakeDone, and demo mode never starts the sync that would set it —
    // so without this every tab sits in its loading state forever.
    // The fabricated identity goes in with the flag, not through
    // loadContext: that path reads IS and is blocked in demo mode, and
    // several screens gate live controls on these IDs being present.
    set((state) => ({
      demoMode: true,
      ...demoContext,
      syncStatus: { ...state.syncStatus, handshakeDone: true },
      // For the same reason, one step further: the demo dataset is already
      // complete, and no sync will ever run to set this, so without it every
      // screen with no rows in the fixture would sit on a skeleton forever.
      firstSyncSettled: true,
    }));
  },

  exitDemo: async () => {
    await wipeSeeded();
    // The fabricated identity leaves with the fabricated data. A real sign-in
    // repopulates it through loadContext; leaving it set would show one
    // student's name over another's session.
    set({
      demoMode: false,
      studiumId: null,
      studentId: null,
      obdobiId: null,
      facultyId: null,
      fullName: null,
      userFaculty: null,
      userSemester: null,
    });
  },
});
