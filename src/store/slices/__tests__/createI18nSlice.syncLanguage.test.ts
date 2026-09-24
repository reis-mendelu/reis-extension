import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The i18n slice is the only writer of the language the sync fetches IS in.
 *
 * A switch must write it BEFORE asking for the refetch: the sync reads it at
 * the start of the run, so asking first would refetch in the language the
 * student just left. Loading mirrors the stored UI language into it, which is
 * how an existing English student's sync learns the language at all.
 */
const order: string[] = [];
const writeSyncLanguage = vi.fn(async (lang: string) => {
  order.push(`write:${lang}`);
});
vi.mock('../../../services/sync/syncLanguage', () => ({
  writeSyncLanguage: (lang: string) => writeSyncLanguage(lang),
}));

import { useAppStore } from '../../useAppStore';
import { syncService } from '../../../services/sync/SyncService';
import { IndexedDBService } from '../../../services/storage';
import { __resetLanguageRefetchForTests } from '../../../services/sync/languageRefetch';

describe('createI18nSlice keeps the sync language in step', () => {
  beforeEach(() => {
    order.length = 0;
    writeSyncLanguage.mockClear();
    __resetLanguageRefetchForTests();
    vi.spyOn(syncService, 'triggerSync').mockImplementation(() => {
      order.push('refetch');
    });
    useAppStore.setState({ language: 'cz', isLanguageLoading: false } as never);
  });

  it('writes the new language, then asks for a refetch in it', async () => {
    await useAppStore.getState().setLanguage('en');
    expect(order).toEqual(['write:en', 'refetch']);
    expect(useAppStore.getState().language).toBe('en');
  });

  it('mirrors the stored UI language on load, without asking for a refetch', async () => {
    await IndexedDBService.set('meta', 'reis_language', 'en');
    await useAppStore.getState().loadLanguage();
    expect(order).toEqual(['write:en']);
  });
});
