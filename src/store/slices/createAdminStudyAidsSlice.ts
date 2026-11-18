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
  loadAdminStudyAids: () => Promise<void>;
  /** True once written; the list is reloaded either way. */
  saveAdminStudyAids: (
    id: string,
    patch: Pick<AdminStudyAids, 'audience' | 'isActive'>
  ) => Promise<boolean>;
}

export const createAdminStudyAidsSlice: AppSlice<AdminStudyAidsSlice> = (set, get) => ({
  adminStudyAids: null,

  loadAdminStudyAids: async () => {
    const list = await fetchAdminStudyAids();
    // A failed reload keeps what is on screen rather than blanking it.
    set({ adminStudyAids: list ?? get().adminStudyAids });
  },

  saveAdminStudyAids: async (id, patch) => {
    const ok = await saveAdminStudyAids(id, patch);
    await get().loadAdminStudyAids();
    return ok;
  },
});
