import type { AppSlice, DemoSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { MockManager } from '../../utils/mock/MockManager';
import { MOCK_REGISTRY } from '../../utils/mock/registry';

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
  'iskam',
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
  demoMode: false,

  enterDemo: async () => {
    // Wiping on the way IN as well as out: a student who signs out and then
    // pokes at the demo must not see their own leftovers presented as sample
    // data, and the reverse must not happen either.
    await wipeSeeded();
    await MockManager.loadDataset(MOCK_REGISTRY.demo!);

    // Load-bearing and easy to miss. The screens gate their content on
    // handshakeDone, and demo mode never starts the sync that would set it —
    // so without this every tab sits in its loading state forever.
    set((state) => ({
      demoMode: true,
      syncStatus: { ...state.syncStatus, handshakeDone: true },
    }));
  },

  exitDemo: async () => {
    await wipeSeeded();
    set({ demoMode: false });
  },
});
