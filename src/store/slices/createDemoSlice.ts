import type { AppSlice, DemoSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { MockManager } from '../../utils/mock/MockManager';
import { MOCK_REGISTRY } from '../../utils/mock/registry';

/** Stores the demo dataset owns outright and may safely clear. */
const SEEDED_STORES = ['exams', 'schedule', 'syllabuses', 'success_rates', 'study_plan'] as const;

/**
 * Keys inside `meta`, deleted individually.
 *
 * `meta` also holds the theme, the language and the crash-report opt-out, so
 * clearing the store to tidy up the demo would reset a student's privacy
 * choice. Delete by key or not at all.
 */
const SEEDED_META_KEYS = ['study_stats', 'study_comparison'] as const;

async function wipeSeeded(): Promise<void> {
  for (const store of SEEDED_STORES) {
    await IndexedDBService.clear(store);
  }
  for (const key of SEEDED_META_KEYS) {
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
