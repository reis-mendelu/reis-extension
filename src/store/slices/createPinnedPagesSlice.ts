import { StorageService } from '../../services/storage';
import type { AppSlice } from '../types';
import type { PageCategory } from '../../data/pages/types';

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
  migratePinnedIds: (navPages: PageCategory[]) => Promise<void>;
}

/** Strip protocol+host and query/fragment so we can compare paths */
function normalizePath(href: string): string {
  try {
    const url = new URL(href, 'https://is.mendelu.cz');
    return url.pathname.replace(/\/+$/, '');
  } catch {
    return href.replace(/\?.*/, '').replace(/\/+$/, '');
  }
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

  migratePinnedIds: async (navPages) => {
    const current = get().pinnedPages;
    if (current.length === 0) return;

    // Build href-path → scraped id lookup
    const pathToId = new Map<string, string>();
    for (const cat of navPages) {
      for (const child of cat.children) {
        pathToId.set(normalizePath(child.href), child.id);
      }
    }

    let changed = false;
    const updated = current.map(pin => {
      const scrapedId = pathToId.get(normalizePath(pin.href));
      if (scrapedId && scrapedId !== pin.id) {
        changed = true;
        return { ...pin, id: scrapedId };
      }
      return pin;
    });

    if (changed) {
      await StorageService.sync.set(STORAGE_KEY, updated);
      set({ pinnedPages: updated });
}
  },
});
