import type { AppSlice, ZaznamnikSlice } from '../types';
import type { SubjectZaznamnik } from '../../types/zaznamnik';

export const createZaznamnikSlice: AppSlice<ZaznamnikSlice> = (set) => ({
    zaznamnik: {},
    setZaznamnikBatch: (data: Record<string, SubjectZaznamnik | null>) => {
        set(state => ({ zaznamnik: { ...state.zaznamnik, ...data } }));
    },
});
