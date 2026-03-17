import { StorageService } from '../../services/storage';
import type { AppSlice } from '../types';

export interface PinnedPage {
  id: string;
  label: string;
  href: string;
}

const MAX_PINS = 6;
const STORAGE_KEY = 'pinned_pages';

export interface PinnedPagesSlice {
  pinnedPages: PinnedPage[];
  loadPinnedPages: () => Promise<void>;
  pinPage: (page: PinnedPage) => Promise<void>;
  unpinPage: (id: string) => Promise<void>;
}

export const createPinnedPagesSlice: AppSlice<PinnedPagesSlice> = (set, get) => ({
  pinnedPages: [],

  loadPinnedPages: async () => {
    const pages = await StorageService.sync.get<PinnedPage[]>(STORAGE_KEY);
    set({ pinnedPages: pages ?? [] });
  },

  pinPage: async (page) => {
    const current = get().pinnedPages;
    if (current.length >= MAX_PINS || current.some(p => p.id === page.id)) return;
    const updated = [...current, page];
    await StorageService.sync.set(STORAGE_KEY, updated);
    set({ pinnedPages: updated });
  },

  unpinPage: async (id) => {
    const updated = get().pinnedPages.filter(p => p.id !== id);
    await StorageService.sync.set(STORAGE_KEY, updated);
    set({ pinnedPages: updated });
  },
});
