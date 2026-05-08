import type { AppSlice, ZaznamnikSlice } from '../types';
import type { SubjectZaznamnik } from '../../types/zaznamnik';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

const isEmpty = (z: SubjectZaznamnik | null | undefined): boolean =>
    !z || (z.ph.sections.length === 0 && z.vt.tests.length === 0);

export const createZaznamnikSlice: AppSlice<ZaznamnikSlice> = (set) => ({
    zaznamnik: {},
    zaznamnikHydrated: false,
    setZaznamnikBatch: (data) => {
        set(state => {
            const next = { ...state.zaznamnik };
            for (const [code, incoming] of Object.entries(data)) {
                // Preserve existing non-empty data when incoming is empty/null (transient parse failure)
                if (isEmpty(incoming) && !isEmpty(next[code])) continue;
                next[code] = incoming;
            }
            return { zaznamnik: next };
        });
    },
    fetchZaznamnik: async () => {
        try {
            const entries = await IndexedDBService.getAllWithKeys('zaznamnik');
            const map: Record<string, SubjectZaznamnik | null> = {};
            for (const { key, value } of entries) map[key] = value;
            set({ zaznamnik: map, zaznamnikHydrated: true });
        } catch (err) {
            logError('ZaznamnikSlice.fetchZaznamnik', err);
            set({ zaznamnikHydrated: true });
        }
    },
});
