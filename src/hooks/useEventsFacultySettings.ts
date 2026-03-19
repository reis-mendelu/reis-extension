import { useState, useEffect, useCallback } from 'react';
import { IndexedDBService } from '../services/storage';
import { getUserParams } from '../utils/userParams';
import type { FacultyKey } from '../types/events';
import { FACULTY_LABEL_TO_KEY } from '../types/events';

const STORAGE_KEY = 'reis_event_faculties';
const CHANGE_EVENT = 'reis-event-faculties-changed';

export function useEventsFacultySettings() {
  const [subscribedFaculties, setSubscribedFaculties] = useState<FacultyKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      let saved = await IndexedDBService.get('meta', STORAGE_KEY) as FacultyKey[] | undefined;

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

      setSubscribedFaculties(saved);
    } catch (err) {
      console.warn('[useEventsFacultySettings] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    const handler = () => loadSettings();
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, [loadSettings]);

  const toggleFaculty = async (key: FacultyKey) => {
    const next = subscribedFaculties.includes(key)
      ? subscribedFaculties.filter(k => k !== key)
      : [...subscribedFaculties, key];
    setSubscribedFaculties(next);
    try {
      await IndexedDBService.set('meta', STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch (err) {
      console.warn('[useEventsFacultySettings] Failed to save:', err);
    }
  };

  const isSubscribed = (key: FacultyKey) => subscribedFaculties.includes(key);

  return { subscribedFaculties, toggleFaculty, isSubscribed, isLoading };
}
