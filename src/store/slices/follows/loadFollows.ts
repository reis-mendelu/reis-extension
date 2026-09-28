import { IndexedDBService } from '../../../services/storage';
import { autoFollowSocietyFor } from '../../../utils/societies/resolveSociety';
import { FACULTY_LABEL_TO_KEY, type Society } from '../../../types/events';
import { migrateAssociationIds } from '../../../services/spolky/renamedAssociations';
import { getUserParams } from '../../../utils/userParams';
import { logError } from '../../../utils/reportError';

// New key for full list
export const STORAGE_KEY = 'reis_subscribed_associations';

/**
 * Whether the student has ever picked their societies by hand.
 *
 * Needed because an empty saved list is ambiguous: it is either "I unsubscribed
 * from everything" or "the faculty could not be resolved the one time defaults
 * were computed". The first must be honoured, the second must be retried — see
 * the comment in `loadFollowedList`.
 */
export const CHOSEN_KEY = 'reis_associations_chosen';

const ERASMUS_AUTO_KEY = 'reis_erasmus_auto_subscribed';

export const MUTED_KEY = 'reis_muted_associations';
export const NOTIFY_PREFS_KEY = 'reis_notify_prefs';
export const NOTIFY_ASKED_KEY = 'reis_notify_asked';

export type NotifyPrefs = { myEvents: boolean; followedEvents: boolean; newEvents: boolean };

export const DEFAULT_PREFS: NotifyPrefs = {
  myEvents: true,
  followedEvents: true,
  newEvents: true,
};

/**
 * Resolves the followed-society list, moved verbatim (with its comments) out
 * of `useSpolkySettings` so the reminder planner can read follows from the
 * store rather than from a component's local state.
 *
 * Returns the final list, or `null` when nothing resolved: no saved list and
 * `getUserParams()` returned nothing, or a read failed. A faculty that maps to
 * no default gives `[]`, which is an answer (and is not persisted).
 *
 * `catalog` is the societies catalog (the composed store's `societies`,
 * passed in rather than read from `useAppStore` here) — `createFollowSlice`
 * lives in the store's own composition, so importing the store back into this
 * file would be circular.
 */
export async function loadFollowedList(catalog: Record<string, Society>): Promise<string[] | null> {
  let result: string[] | null = null;
  try {
    // 1. Try to get new full list
    let saved = (await IndexedDBService.get('meta', STORAGE_KEY)) as string[] | undefined;
    const chosenByHand = Boolean(await IndexedDBService.get('meta', CHOSEN_KEY));

    // An empty list that nobody chose is not an answer, it is a failed
    // lookup — and `[]` is truthy, so it used to end the search for good.
    //
    // Defaults are computed once, the first time IDB has nothing. `#titulek`
    // does not always parse (a doctoral or combined-study header), and on the
    // long-lived Capacitor app `getUserParams` can lose the race with session
    // restore at boot, so `facultyLabel` comes back undefined and the
    // defaults come out empty. Persisting that left the student subscribed to
    // NOTHING permanently: every society event was filtered out of Novinky on
    // every later boot, however well the faculty parsed by then. Reported as
    // "the deskovky test notification didn't appear in the notification".
    // ONE re-resolution, then never again. Before CHOSEN_KEY existed,
    // `toggleAssociation` also persisted `[]` when a student removed their
    // last society — so a stored empty list is genuinely ambiguous on an
    // install that predates this flag: it is either that deliberate choice or
    // the failed lookup below. It cannot be told apart after the fact.
    //
    // Re-resolving once and then MARKING it chosen bounds the cost either
    // way: a student who meant to be empty gets their faculty back a single
    // time and can remove it again for good, and a student stuck on the bug
    // is repaired. Leaving it unmarked would re-subscribe the first student
    // on every launch, which is the version of this that would be resented.
    const unresolvedEmpty = Array.isArray(saved) && saved.length === 0 && !chosenByHand;
    if (!saved || unresolvedEmpty) {
      // Determine defaults
      const userParams = await getUserParams();

      if (userParams) {
        const defaults: string[] = [];
        const facultyLabel = userParams.facultyLabel;
        const erasmus = userParams.isErasmus;

        // The faculty's default society comes from the catalog, which is
        // never empty (bundled seed), so this cannot run "before" it.
        const facultyKey = facultyLabel ? FACULTY_LABEL_TO_KEY[facultyLabel] : undefined;
        const facultyDefault = facultyKey ? autoFollowSocietyFor(catalog, facultyKey) : null;
        if (facultyDefault && !erasmus) defaults.push(facultyDefault);

        if (erasmus) {
          defaults.push('esn');
          await IndexedDBService.set('meta', ERASMUS_AUTO_KEY, true);
        }

        saved = defaults;
        // ...and only if they resolved to something. An empty result is the
        // failed lookup above; leaving IDB untouched is what lets the next
        // boot try again.
        if (defaults.length > 0) {
          await IndexedDBService.set('meta', STORAGE_KEY, saved);
          // The one-time part of the migration above: an install that held
          // `[]` has now had its single re-resolution, so what it ends up
          // with is a settled answer. Only a resolution that found something
          // counts — marking a failed lookup would end the retries for good.
          if (unresolvedEmpty) await IndexedDBService.set('meta', CHOSEN_KEY, true);
        }
      }
    }

    if (saved) {
      // Renamed society ids, before anything reads the list. Unconditional on
      // CHOSEN_KEY: picking the old society by hand is both the commonest way
      // to hold its id and the thing that sets the flag.
      const before = saved;
      saved = migrateAssociationIds(saved);

      result = saved;

      // Hydrate first, persist second, in its own catch. Awaiting the write
      // BEFORE the setState meant a failed transaction fell through to the
      // outer catch and skipped hydration — a student with a good saved list
      // spent the session subscribed to nothing, the exact failure the rest
      // of this function exists to prevent. Losing only the write is
      // harmless: the map is permanent, so the next boot migrates again.
      if (saved !== before) {
        try {
          await IndexedDBService.set('meta', STORAGE_KEY, saved);
        } catch (err) {
          logError('Follows.migrateIds', err);
        }
      }

      // NEW: Robust auto-subscription for existing users who haven't been auto-subscribed yet
      const userParams = await getUserParams();
      if (userParams?.isErasmus && !saved.includes('esn')) {
        const autoSubscribedFlag = await IndexedDBService.get('meta', ERASMUS_AUTO_KEY);
        if (!autoSubscribedFlag) {
          const updated = [...saved, 'esn'];
          result = updated;
          await IndexedDBService.set('meta', STORAGE_KEY, updated);
          await IndexedDBService.set('meta', ERASMUS_AUTO_KEY, true);
        }
      }
    }
  } catch (err) {
    logError('Follows.load', err);
  }
  return result;
}

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
