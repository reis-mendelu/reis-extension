import type { AppSlice } from '../types';
import type { Society } from '../../types/events';
import { fetchSocieties } from '../../api/societies';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { toSocietyRecord } from '../../utils/societies/resolveSociety';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import type { SocietyInput } from '../../api/societiesAdmin';
import { saveSociety, setSocietyActive, type SaveSocietyError } from './societies/saveSociety';

export const SOCIETIES_CACHE_KEY = 'societies_catalog';

export interface SocietiesSlice {
  /** Every society, hidden ones included. Never empty: starts as the bundled seed. */
  societies: Record<string, Society>;
  societiesCacheRead: boolean;
  /** Cache (once), then network. Called with every events load and on native resume. */
  loadSocieties: () => Promise<void>;
  /** After an admin save: show it now, without waiting for the next fetch. */
  putSociety: (society: Society) => Promise<void>;
  /** Admin console, reis_admin only (RLS enforces it). `logo` is the picked file. */
  saveSociety: (
    input: SocietyInput,
    logo: Blob | null,
    isNew: boolean
  ) => Promise<{ error?: SaveSocietyError }>;
  /** Hide or show; hidden societies still resolve for their old events. */
  setSocietyActive: (id: string, active: boolean) => Promise<boolean>;
}

function isSociety(value: unknown): value is Society {
  const s = value as Society;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.shortName === 'string' &&
    typeof s.color === 'string' &&
    typeof s.facultyKey === 'string' &&
    typeof s.isActive === 'boolean'
  );
}

export const createSocietiesSlice: AppSlice<SocietiesSlice> = (set, get) => ({
  societies: BUNDLED_SOCIETIES,
  societiesCacheRead: false,

  loadSocieties: async () => {
    if (!get().societiesCacheRead) {
      try {
        const cached: unknown = await IndexedDBService.get('meta', SOCIETIES_CACHE_KEY);
        if (Array.isArray(cached) && cached.length > 0 && cached.every(isSociety)) {
          set({ societies: toSocietyRecord(cached) });
        }
      } catch (err) {
        logError('SocietiesSlice.readCache', err);
      }
      set({ societiesCacheRead: true });
    }

    const fresh = await fetchSocieties();
    // null is a failed fetch; [] is a table this client cannot read (RLS,
    // an outage). Neither may wipe a catalog every screen depends on.
    if (!fresh || fresh.length === 0) return;
    set({ societies: toSocietyRecord(fresh) });
    try {
      await IndexedDBService.set('meta', SOCIETIES_CACHE_KEY, fresh);
    } catch (err) {
      logError('SocietiesSlice.writeCache', err);
    }
  },

  putSociety: async (society) => {
    const societies = { ...get().societies, [society.id]: society };
    set({ societies });
    try {
      await IndexedDBService.set('meta', SOCIETIES_CACHE_KEY, Object.values(societies));
    } catch (err) {
      logError('SocietiesSlice.writeCache', err);
    }
  },

  saveSociety: (input, logo, isNew) =>
    saveSociety({ societies: () => get().societies, put: get().putSociety }, input, logo, isNew),

  setSocietyActive: (id, active) =>
    setSocietyActive({ societies: () => get().societies, put: get().putSociety }, id, active),
});
