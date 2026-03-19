import { useState, useEffect, useCallback } from 'react';
import { fetchEvents } from '../api/events';
import { useEventsFacultySettings } from './useEventsFacultySettings';
import { useAppStore } from '../store/useAppStore';
import { IndexedDBService } from '../services/storage';
import type { MendeluEvent } from '../types/events';

const CACHE_PREFIX = 'reis_events_cache_';
const REFRESH_MS = 30 * 60 * 1000;

export function useEventsFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [allEvents, setAllEvents] = useState<MendeluEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const { subscribedFaculties, isLoading: settingsLoading } = useEventsFacultySettings();
  const language = useAppStore(s => s.language);
  const cacheKey = `${CACHE_PREFIX}${language}`;

  useEffect(() => {
    setAllEvents([]);
    IndexedDBService.get('meta', cacheKey).then(c => {
      if (c) setAllEvents(c as MendeluEvent[]);
    });
  }, [cacheKey]);

  const load = useCallback(async () => {
    if (allEvents.length === 0) setLoading(true);
    try {
      const events = await fetchEvents(language);
      setAllEvents(events);
      IndexedDBService.set('meta', cacheKey, events);
    } catch (e) {
      console.warn('[useEventsFeed] Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [allEvents.length, language, cacheKey]);

  useEffect(() => {
    if (!settingsLoading) {
      load();
      const id = setInterval(load, REFRESH_MS);
      return () => clearInterval(id);
    }
  }, [load, settingsLoading]);

  const events = allEvents.filter(e => subscribedFaculties.includes(e.organizerKey));
  const toggle = () => setIsOpen(o => !o);

  return { isOpen, setIsOpen, events, loading, toggle };
}
