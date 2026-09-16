import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSpolkySettings } from './useSpolkySettings';
import { visibleToStudent } from '../utils/eventAudience';
import type { MapEvent } from '../types/events';

/**
 * The map events this student should be shown.
 *
 * `mapEvents` in the store is everything the public fetch returned — the fetch
 * is anonymous, so the server cannot do this filtering and never sees the
 * answer. A society can mark an event for its followers only, and that is
 * honoured here, at READ time: subscriptions live in IndexedDB rather than the
 * store, so this has to be a hook rather than a selector, and doing it on read
 * means toggling a society in settings changes the map with no refetch.
 *
 * The single seam for it. Both surfaces that DISPLAY events go through this —
 * the pins (`EventLayer`) and the list (`MapEventsSection`) — so the two cannot
 * disagree about what is on the map.
 *
 * Deliberately NOT used by `NotificationsSheet`, which reads `mapEvents` to
 * resolve a tapped notification to an event rather than to show a list: the
 * feed is subscription-filtered already, so anything it can offer is something
 * this student follows, and filtering there would only be able to break the tap.
 */
export function useVisibleMapEvents(): MapEvent[] {
  const events = useAppStore((s) => s.mapEvents);
  const { subscribedAssociations, isLoading } = useSpolkySettings();

  return useMemo(
    // `null` while the settings are still coming out of IndexedDB — an empty
    // list then means "not loaded", not "follows nothing", and hiding on it
    // would blink every restricted event off the map and back on a cold open.
    () => visibleToStudent(events, isLoading ? null : subscribedAssociations),
    [events, subscribedAssociations, isLoading]
  );
}
