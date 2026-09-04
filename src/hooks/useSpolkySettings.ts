import { useState, useEffect, useCallback, useRef } from 'react';
import { IndexedDBService } from '../services/storage';
import { FACULTY_TO_ASSOCIATION } from '../services/spolky/config';
import { getUserParams } from '../utils/userParams';
import { logError } from '../utils/reportError';

// New key for full list
const STORAGE_KEY = 'reis_subscribed_associations';

/**
 * Whether the student has ever picked their societies by hand.
 *
 * Needed because an empty saved list is ambiguous: it is either "I unsubscribed
 * from everything" or "the faculty could not be resolved the one time defaults
 * were computed". The first must be honoured, the second must be retried — see
 * the comment in `loadSettings`.
 */
const CHOSEN_KEY = 'reis_associations_chosen';

export function useSpolkySettings() {
  const [subscribedAssociations, setSubscribedAssociations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // loadSettings awaits IndexedDB and getUserParams, so its tail can land long
  // after the component is gone — on unmount, or in tests once the DOM has been
  // torn down, where touching React state throws "window is not defined" and
  // fails the whole run. Declared before the effect that calls loadSettings so
  // it is set to true first on mount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSettings = useCallback(async () => {
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

          if (facultyLabel && FACULTY_TO_ASSOCIATION[facultyLabel] && !erasmus) {
            defaults.push(FACULTY_TO_ASSOCIATION[facultyLabel]);
          }

          if (erasmus) {
            defaults.push('esn');
            await IndexedDBService.set('meta', 'reis_erasmus_auto_subscribed', true);
          }

          saved = defaults;
          // ...and only if they resolved to something. An empty result is the
          // failed lookup above; leaving IDB untouched is what lets the next
          // boot try again.
          if (defaults.length > 0) {
            await IndexedDBService.set('meta', STORAGE_KEY, saved);
          }
          // The one-time part of the migration above: an install that already
          // held `[]` has now had its single re-resolution, so record that
          // whatever it ends up with is a settled answer.
          if (unresolvedEmpty) {
            await IndexedDBService.set('meta', CHOSEN_KEY, true);
          }
        }
      }

      if (saved) {
        if (!mountedRef.current) return;
        setSubscribedAssociations(saved);

        // NEW: Robust auto-subscription for existing users who haven't been auto-subscribed yet
        const userParams = await getUserParams();
        if (userParams?.isErasmus && !saved.includes('esn')) {
          const autoSubscribedFlag = await IndexedDBService.get(
            'meta',
            'reis_erasmus_auto_subscribed'
          );
          if (!autoSubscribedFlag) {
            const updated = [...saved, 'esn'];
            if (mountedRef.current) setSubscribedAssociations(updated);
            await IndexedDBService.set('meta', STORAGE_KEY, updated);
            await IndexedDBService.set('meta', 'reis_erasmus_auto_subscribed', true);
          }
        }
      }
    } catch (err) {
      logError('useSpolkySettings.load', err);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  // Pre-existing pattern, flagged only because this file is now in the
  // changed-files lint gate. loadSettings is an async IndexedDB read whose
  // results have to land in state somehow; removing the effect means moving
  // spolky settings into a store slice, which is the project's stated
  // direction but not a change to smuggle into this commit. Same scoped
  // disable as useWatchdog (see issue #157).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, [loadSettings]);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handleStorageChange = () => {
      // Re-load from IndexedDB when notified of changes
      loadSettings();
    };

    window.addEventListener('reis-spolky-settings-changed', handleStorageChange);
    return () => {
      window.removeEventListener('reis-spolky-settings-changed', handleStorageChange);
    };
  }, [loadSettings]);

  const toggleAssociation = async (associationId: string) => {
    const newSettings = subscribedAssociations.includes(associationId)
      ? subscribedAssociations.filter((id: string) => id !== associationId)
      : [...subscribedAssociations, associationId];

    setSubscribedAssociations(newSettings);

    try {
      // CHOSEN_KEY first, deliberately. There are two writes and no transaction
      // across them, so one of the two orders has to be safe: marking "chosen"
      // before the list means a crash between them leaves the OLD list marked
      // as settled, which is merely stale. The other order leaves the new list
      // unmarked — and if that list is empty, the next boot treats the
      // student's deliberate choice as an unresolved lookup and undoes it.
      await IndexedDBService.set('meta', CHOSEN_KEY, true);
      await IndexedDBService.set('meta', STORAGE_KEY, newSettings);
      // Dispatch event for other hooks in the same tab
      window.dispatchEvent(new Event('reis-spolky-settings-changed'));
    } catch (err) {
      logError('useSpolkySettings.save', err);
    }
  };

  const isSubscribed = (associationId: string) => {
    return subscribedAssociations.includes(associationId);
  };

  return {
    subscribedAssociations,
    toggleAssociation,
    isSubscribed,
    isLoading,
  };
}
