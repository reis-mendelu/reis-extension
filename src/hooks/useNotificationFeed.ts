import { useState, useEffect, useCallback, useMemo } from 'react';
// Straight from the implementation files, not the barrel beside them: the Iron
// Rule in CLAUDE.md forbids adding to a re-export, and `services/spolky/index`
// is one.
import { dropPastEvents, dropBeyondNovinkyWindow } from '../services/spolky/spolkyService';
import { dropScheduledEvents } from '../services/spolky/dropScheduledEvents';
import type { SpolekNotification } from '../services/spolky/types';
import { localTodayIso } from '../components/CampusMap/eventWindow';
import { canSee } from '../utils/eventAudience';
import { useViewer } from './useViewer';
import { useAppStore } from '../store/useAppStore';

/** reIS's own rows (admin, academic deadlines) are for everyone, as before. */
const isReisRow = (n: SpolekNotification) =>
  !n.associationId || n.associationId === 'admin' || n.associationId.startsWith('academic_');

export function useNotificationFeed() {
  const [isOpen, setIsOpen] = useState(false);

  const allNotifications = useAppStore((s) => s.notifications.data);
  const loading = useAppStore((s) => s.notifications.status === 'loading');
  const readIds = useAppStore((s) => s.notifications.readIds);
  const viewedIds = useAppStore((s) => s.notifications.viewedIds);

  const markNotificationsRead = useAppStore((s) => s.markNotificationsRead);
  const markNotificationViewed = useAppStore((s) => s.markNotificationViewed);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);

  const societies = useAppStore((s) => s.societies);
  const viewer = useViewer();

  // A string, so it is stable across renders within a day and the memo below
  // does not rebuild the list (and re-render every consumer) on every tick.
  // The LOCAL day, never toISOString() (UTC): at 00:30 in Brno UTC still says
  // yesterday, exactly when "is this event over?" changes its answer.
  const todayIso = localTodayIso();

  // Four questions: is the student in this event's audience (utils/eventAudience
  // — no follow list), has the event already happened, is it within the
  // Novinky week, and has it gone live yet? The list can come from
  // `notifications_cache` in IndexedDB, which is written whenever a fetch lands
  // and is never re-examined, so without the second question a past event
  // stays in the feed unread and highlighted — "deskovky notification still
  // shows and highlights even a day after they happened". Without the third, an
  // event the console lists as "Naplánované — zveřejní se …" reached Novinky
  // (and its view/click counts) the moment it was published. Both trees read
  // this list, so the badge, the rows and the view counter all follow it.
  const notifications = useMemo(
    () =>
      dropScheduledEvents(
        dropBeyondNovinkyWindow(
          dropPastEvents(
            allNotifications.filter(
              (n) =>
                isReisRow(n) ||
                canSee(
                  { societyId: n.associationId ?? '', subscribersOnly: n.subscribersOnly },
                  societies,
                  viewer
                )
            ),
            todayIso
          ),
          todayIso
        )
      ),
    [allNotifications, societies, viewer, todayIso]
  );

  const load = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const id = setInterval(load, 300000);
    return () => clearInterval(id);
  }, [load]);

  const toggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && notifications.length > 0) {
      markNotificationsRead(notifications.map((n) => n.id));
    }
  };

  const markVisible = (id: string) => {
    markNotificationViewed(id);
  };

  return {
    isOpen,
    setIsOpen,
    notifications,
    loading,
    readIds,
    viewedIds,
    toggle,
    markVisible,
    load,
  };
}
