import { create } from 'zustand';
import { IndexedDBService } from '../services/storage';
import { syncIskam } from '../services/sync/syncIskam';
import { IskamAuthError } from '../api/iskam';
import type { IskamData } from '../types/iskam';
import type { Status } from './types';

export interface IskamStoreState {
    data: IskamData | null;
    status: Status;
    error: 'auth' | 'network' | null;
    loadFromCache: () => Promise<void>;
    refresh: () => Promise<void>;
}

export const useIskamStore = create<IskamStoreState>((set, get) => ({
    data: null,
    status: 'idle',
    error: null,

    loadFromCache: async () => {
        try {
            const cached = await IndexedDBService.get('iskam', 'current');
            if (cached) {
                set({ data: cached, status: 'success', error: null });
            }
        } catch {
            // Cache miss is not an error; refresh() will populate.
        }
    },

    refresh: async () => {
        const hasData = get().data !== null;
        set({ status: hasData ? 'success' : 'loading', error: null });
        try {
            await syncIskam();
            const fresh = await IndexedDBService.get('iskam', 'current');
            set({ data: fresh ?? null, status: 'success', error: null });
        } catch (err) {
            const isAuth = err instanceof IskamAuthError;
            set({ status: 'error', error: isAuth ? 'auth' : 'network' });
        }
    },
}));
