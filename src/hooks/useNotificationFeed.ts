import { useState, useEffect, useCallback, useMemo } from 'react';
import { filterNotificationsByFaculty } from '../services/spolky';
// Straight from the implementation file, not the barrel beside it: the Iron
// Rule in CLAUDE.md forbids adding to a re-export, and `services/spolky/index`
// is one. The pre-existing entries stay where they are.
import { dropPastEvents, localDayIso } from '../services/spolky/spolkyService';
import { useSpolkySettings } from '../hooks/useSpolkySettings';
import { useAppStore } from '../store/useAppStore';

export function useNotificationFeed() {
  const [isOpen, setIsOpen] = useState(false);

  const allNotifications = useAppStore((s) => s.notifications.data);
  const loading = useAppStore((s) => s.notifications.status === 'loading');
  const readIds = useAppStore((s) => s.notifications.readIds);
  const viewedIds = useAppStore((s) => s.notifications.viewedIds);

  const markNotificationsRead = useAppStore((s) => s.markNotificationsRead);
  const markNotificationViewed = useAppStore((s) => s.markNotificationViewed);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);

  const { subscribedAssociations, isLoading: settingsLoading } = useSpolkySettings();

  // A string, so it is stable across renders within a day and the memo below
  // does not rebuild the list (and re-render every consumer) on every tick.
  const todayIso = localDayIso();

  // Two questions, and the feed has only ever asked the first: is this society
  // one the student follows, and has the event already happened? The list can
  // come from `notifications_cache` in IndexedDB, which is written whenever a
  // fetch lands and is never re-examined, so without the second question a past
  // event stays in the feed unread and highlighted — "deskovky notification
  // still shows and highlights even a day after they happened".
  const notifications = useMemo(
    () =>
      dropPastEvents(
        filterNotificationsByFaculty(allNotifications, subscribedAssociations),
        todayIso
      ),
    [allNotifications, subscribedAssociations, todayIso]
  );

  const load = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!settingsLoading) {
      const id = setInterval(load, 300000);
      return () => clearInterval(id);
    }
  }, [load, settingsLoading]);

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
    settingsLoading,
    load,
  };
}
