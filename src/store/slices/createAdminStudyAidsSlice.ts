import type { AppSlice } from '../types';
import {
  fetchAdminStudyAids,
  saveAdminStudyAids,
  type AdminStudyAids,
} from '../../api/adminStudyAids';

/**
 * The console's "Studijní opory" section (reis_admin only): every study-aids
 * link, switched off ones included, with its audience. Reads and writes are
 * refused by RLS for anyone but reis_admin.
 */
export interface AdminStudyAidsSlice {
  /** null until loaded, or when the last load failed. */
  adminStudyAids: AdminStudyAids[] | null;
  /** A read is out. Null rows while loading is "not yet", not "failed". */
  adminStudyAidsLoading: boolean;
  loadAdminStudyAids: () => Promise<void>;
  /** True once written; the list is reloaded either way. */
  saveAdminStudyAids: (
    id: string,
    patch: Pick<AdminStudyAids, 'audience' | 'isActive'>
  ) => Promise<boolean>;
}

export const createAdminStudyAidsSlice: AppSlice<AdminStudyAidsSlice> = (set, get) => {
  // Which read is the newest. A tab refresh that read the old row can answer
  // after a save and its reload; it must not put the old row back.
  let latest = 0;
  return {
    adminStudyAids: null,
    adminStudyAidsLoading: false,

    loadAdminStudyAids: async () => {
      const mine = ++latest;
      set({ adminStudyAidsLoading: true });
      const list = await fetchAdminStudyAids();
      // Superseded: the newer read's answer is the one to keep, and it lowers
      // the flag when it lands.
      if (mine !== latest) return;
      // A failed reload keeps what is on screen rather than blanking it.
      set({ adminStudyAids: list ?? get().adminStudyAids, adminStudyAidsLoading: false });
    },

    saveAdminStudyAids: async (id, patch) => {
      const ok = await saveAdminStudyAids(id, patch);
      await get().loadAdminStudyAids();
      return ok;
    },
  };
};
