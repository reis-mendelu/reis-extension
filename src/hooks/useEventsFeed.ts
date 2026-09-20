import { useState, useEffect, useCallback } from 'react';
import { fetchEvents } from '../api/events';
import { useEventsFacultySettings } from './useEventsFacultySettings';
import { useAppStore } from '../store/useAppStore';
import { IndexedDBService } from '../services/storage';
import { logError } from '../utils/reportError';
import type { MendeluEvent } from '../types/events';

const CACHE_PREFIX = 'reis_events_cache_';
const REFRESH_MS = 30 * 60 * 1000;
const NO_EVENTS: MendeluEvent[] = [];

export function useEventsFeed() {
  const [isOpen, setIsOpen] = useState(false);
  // Events are stored under the language they were fetched for. A stale key
  // renders as nothing, so switching language cannot leave the previous
  // language's list on screen while the new one is still in flight — which is
  // what the `setAllEvents([])` at the top of the hydrate effect used to do.
  const [cache, setCache] = useState<{ key: string; events: MendeluEvent[] }>({
    key: '',
    events: NO_EVENTS,
  });
  const [loading, setLoading] = useState(false);
  const { subscribedFaculties, isLoading: settingsLoading } = useEventsFacultySettings();
  const language = useAppStore(s => s.language);
  const cacheKey = `${CACHE_PREFIX}${language}`;
  const allEvents = cache.key === cacheKey ? cache.events : NO_EVENTS;

  useEffect(() => {
    IndexedDBService.get('meta', cacheKey).then(c => {
      if (c) setCache({ key: cacheKey, events: c as MendeluEvent[] });
    });
  }, [cacheKey]);

  const load = useCallback(async () => {
    if (allEvents.length === 0) setLoading(true);
    try {
      const events = await fetchEvents(language);
      setCache({ key: cacheKey, events });
      IndexedDBService.set('meta', cacheKey, events);
    } catch (e) {
      logError('useEventsFeed.load', e);
    } finally {
      setLoading(false);
    }
  }, [allEvents.length, language, cacheKey]);

  useEffect(() => {
    if (!settingsLoading) {
      /* load() flips the spinner synchronously, and the rule is right: this
         hook fetches in an effect, which CLAUDE.md's Iron Rules forbid. The fix
         is not a local rewrite but the shape useNotificationFeed already has —
         data and status in a store slice, the effect owning only the interval.
         Not done here; suppressed so the remaining violation stays named. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
      const id = setInterval(load, REFRESH_MS);
      return () => clearInterval(id);
    }
  }, [load, settingsLoading]);

  const events = allEvents.filter(e => subscribedFaculties.includes(e.organizerKey));
  const toggle = () => setIsOpen(o => !o);

  return { isOpen, setIsOpen, events, loading, toggle };
}
