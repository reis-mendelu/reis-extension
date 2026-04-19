import { useState, useEffect, useCallback, useMemo } from 'react';
import { filterNotificationsByFaculty } from '../services/spolky';
import { useSpolkySettings } from '../hooks/useSpolkySettings';
import { useAppStore } from '../store/useAppStore';

export function useNotificationFeed() {
  const [isOpen, setIsOpen] = useState(false);
  
  const allNotifications = useAppStore(s => s.notifications.data);
  const loading = useAppStore(s => s.notifications.status === 'loading');
  const readIds = useAppStore(s => s.notifications.readIds);
  const viewedIds = useAppStore(s => s.notifications.viewedIds);
  
  const markNotificationsRead = useAppStore(s => s.markNotificationsRead);
  const markNotificationViewed = useAppStore(s => s.markNotificationViewed);
  const fetchNotifications = useAppStore(s => s.fetchNotifications);

  const { subscribedAssociations, isLoading: settingsLoading } = useSpolkySettings();

  const notifications = useMemo(() => 
    filterNotificationsByFaculty(allNotifications, subscribedAssociations),
    [allNotifications, subscribedAssociations]
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
      markNotificationsRead(notifications.map(n => n.id));
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
    load 
  };
}
