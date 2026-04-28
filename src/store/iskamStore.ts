import { create } from 'zustand';
import { IndexedDBService } from '../services/storage';
import { useAppStore } from './useAppStore';
import { fetchSkmDocuments } from '../api/iskam/skmDocuments';
import type { IskamData, SkmDocument } from '../types/iskam';
import type { Status } from './types';

export interface IskamStoreState {
    data: IskamData | null;
    skmDocuments: SkmDocument[];
    status: Status;
    error: 'auth' | 'network' | null;
    handshakeDone: boolean;
    handshakeTimedOut: boolean;
    loadFromCache: () => Promise<void>;
    loadSkmDocuments: () => Promise<void>;
    receiveSync: (iskamData: IskamData | null, isSyncing: boolean, error: 'auth' | 'network' | null) => void;
}

export const useIskamStore = create<IskamStoreState>((set) => {
    setTimeout(() => { set({ handshakeTimedOut: true }); }, 10000);

    return {
        data: null,
        skmDocuments: [],
        status: 'idle',
        error: null,
        handshakeDone: false,
        handshakeTimedOut: false,

        loadFromCache: async () => {
            try {
                const cached = await IndexedDBService.get('iskam', 'current');
                if (cached) {
                    const data = cached as IskamData;
                    // Guard: migrate old cache shapes to current field names.
                    if (!Array.isArray(data.foodTransactions)) data.foodTransactions = [];
                    if (!Array.isArray(data.skmDocuments)) data.skmDocuments = [];
                    set({ data, status: 'success', error: null });
                }
            } catch { /* cache miss — receiveSync will populate */ }
        },

        loadSkmDocuments: async () => {
            console.log('[ISKAM] Fetching SKM documents from iframe context...');
            try {
                const docs = await fetchSkmDocuments();
                console.log('[ISKAM] SKM documents fetched:', docs.length, docs);
                set({ skmDocuments: docs });
            } catch (e) {
                console.warn('[ISKAM] SKM documents fetch failed:', e);
            }
        },

        receiveSync: (iskamData, isSyncing, error) => {
            if (iskamData !== null) {
                set({ data: iskamData, status: 'success', error: null, handshakeDone: true });
            } else if (error !== null) {
                set({ status: 'error', error, handshakeDone: true });
            } else if (!isSyncing) {
                // Sync complete, no data, no error — empty state, unblock skeleton.
                set({ handshakeDone: true });
            }
            // isSyncing=true, no data, no error: sync in flight — preserve state, skeleton persists.
        },
    };
});

// Called by IskamApp instead of initializeStore() — only loads shared theme/language.
export async function initializeIskamStore(): Promise<() => void> {
    const s = useAppStore.getState();
    s.loadTheme();
    s.loadLanguage();

    const bcTheme = new BroadcastChannel('reis_theme_sync');
    bcTheme.onmessage = () => useAppStore.getState().loadTheme();
    const bcLang = new BroadcastChannel('reis_language_sync');
    bcLang.onmessage = () => useAppStore.getState().loadLanguage();

    return () => { bcTheme.close(); bcLang.close(); };
}
