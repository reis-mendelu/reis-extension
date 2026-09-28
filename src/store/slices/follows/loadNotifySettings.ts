import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import {
  MUTED_KEY,
  NOTIFY_PREFS_KEY,
  NOTIFY_ASKED_KEY,
  DEFAULT_PREFS,
  type NotifyPrefs,
} from './loadFollows';

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNotifyPrefs(v: unknown): v is NotifyPrefs {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<NotifyPrefs>;
  return (
    typeof p.myEvents === 'boolean' &&
    typeof p.followedEvents === 'boolean' &&
    typeof p.newEvents === 'boolean'
  );
}

/** Mutes, notification switches and whether permission has been asked for. */
export async function loadNotifySettings(): Promise<{
  muted: string[];
  prefs: NotifyPrefs;
  asked: boolean;
}> {
  try {
    const [mutedRaw, prefsRaw, askedRaw] = await Promise.all([
      IndexedDBService.get('meta', MUTED_KEY),
      IndexedDBService.get('meta', NOTIFY_PREFS_KEY),
      IndexedDBService.get('meta', NOTIFY_ASKED_KEY),
    ]);

    return {
      muted: isStringArray(mutedRaw) ? mutedRaw : [],
      prefs: isNotifyPrefs(prefsRaw) ? prefsRaw : DEFAULT_PREFS,
      asked: askedRaw === true,
    };
  } catch (err) {
    logError('Follows.loadNotifySettings', err);
    return { muted: [], prefs: DEFAULT_PREFS, asked: false };
  }
}
