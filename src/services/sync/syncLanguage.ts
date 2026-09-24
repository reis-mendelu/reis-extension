import { getPlatform } from '../../platform';
import type { Language } from '../../store/types';
import { logError } from '../../utils/reportError';

/**
 * The language the sync fetches IS in — the student's own.
 *
 * In platform storage, not IndexedDB, because of who reads it: in the extension
 * the sync runs in the content script on is.mendelu.cz, which cannot see the
 * iframe's IndexedDB (another origin), while chrome.storage.local is shared by
 * both. On the phone it is Preferences, in the same context as the store.
 *
 * The i18n slice is the only writer: it mirrors the stored UI language here
 * on load and writes it before asking for a refetch on a switch.
 */
export const SYNC_LANGUAGE_KEY = 'reis_sync_language';

/** `'cz'` until the app has written one — the app's own default language. */
export async function readSyncLanguage(): Promise<Language> {
  try {
    return (await getPlatform().storage.get(SYNC_LANGUAGE_KEY)) === 'en' ? 'en' : 'cz';
  } catch (e) {
    logError('SyncLanguage.read', e);
    return 'cz';
  }
}

export async function writeSyncLanguage(language: Language): Promise<void> {
  try {
    await getPlatform().storage.set(SYNC_LANGUAGE_KEY, language);
  } catch (e) {
    logError('SyncLanguage.write', e);
  }
}
