import { useState, useEffect, useCallback, useRef } from 'react';
import { IndexedDBService } from '../services/storage';
import { getUserParams } from '../utils/userParams';
import { logError } from '../utils/reportError';
import type { FacultyKey } from '../types/events';
import { FACULTY_LABEL_TO_KEY } from '../types/events';

const STORAGE_KEY = 'reis_event_faculties';
const CHANGE_EVENT = 'reis-event-faculties-changed';

export function useEventsFacultySettings() {
  const [subscribedFaculties, setSubscribedFaculties] = useState<FacultyKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // `loadSettings` awaits IndexedDB and getUserParams, so its tail can land
  // long after the component is gone — on unmount, or in a test once the DOM
  // has been torn down, where touching React state throws and fails the run
  // even though every assertion passed. The same guard, for the same reason,
  // as `useSpolkySettings`; surfaced by the MapRail tests, which mount and
  // unmount the events list several times in a row.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      let saved = (await IndexedDBService.get('meta', STORAGE_KEY)) as FacultyKey[] | undefined;

      if (!saved) {
        const userParams = await getUserParams();
        const defaults: FacultyKey[] = ['mendelu'];
        if (userParams?.facultyLabel) {
          const fk = FACULTY_LABEL_TO_KEY[userParams.facultyLabel];
          if (fk && fk !== 'mendelu') defaults.push(fk);
        }
        saved = defaults;
        await IndexedDBService.set('meta', STORAGE_KEY, saved);
      }

      if (!mountedRef.current) return;
      setSubscribedFaculties(saved);
    } catch (err) {
      logError('useEventsFacultySettings.load', err);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  // Pre-existing pattern, flagged only because this file entered the
  // changed-files lint gate with the unmount guard above. `loadSettings` is an
  // async IndexedDB read whose result has to land in state somehow; removing
  // the effect means moving event-faculty settings into a store slice, which
  // is the project's stated direction but not a change to smuggle in here.
  // Same scoped disable, and the same reasoning, as `useSpolkySettings`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handler = () => loadSettings();
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, [loadSettings]);

  const toggleFaculty = async (key: FacultyKey) => {
    const next = subscribedFaculties.includes(key)
      ? subscribedFaculties.filter((k) => k !== key)
      : [...subscribedFaculties, key];
    setSubscribedFaculties(next);
    try {
      await IndexedDBService.set('meta', STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch (err) {
      logError('useEventsFacultySettings.save', err);
    }
  };

  const isSubscribed = (key: FacultyKey) => subscribedFaculties.includes(key);

  return { subscribedFaculties, toggleFaculty, isSubscribed, isLoading };
}
