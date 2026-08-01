import { useState, useEffect, useCallback, useRef } from 'react';
import { IndexedDBService } from '../services/storage';
import { FACULTY_TO_ASSOCIATION } from '../services/spolky/config';
import { getUserParams } from '../utils/userParams';
import { logError } from '../utils/reportError';

// New key for full list
const STORAGE_KEY = 'reis_subscribed_associations';

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

      if (!saved) {
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
          // Save defaults only if we had userParams to determine them
          await IndexedDBService.set('meta', STORAGE_KEY, saved);
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
