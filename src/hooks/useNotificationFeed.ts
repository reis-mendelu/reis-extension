import { useState, useEffect, useCallback } from 'react';
import type { SpolekNotification } from '../services/spolky';
import { fetchNotifications, trackNotificationsViewed, trackNotificationClick, filterNotificationsByFaculty } from '../services/spolky';
import { useSpolkySettings } from '../hooks/useSpolkySettings';
import { IndexedDBService } from '../services/storage';

export function useNotificationFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SpolekNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const { subscribedAssociations, isLoading: settingsLoading } = useSpolkySettings();

  useEffect(() => {
    IndexedDBService.get('meta', 'read_notifications').then(s => s && setReadIds(new Set(s)));
    IndexedDBService.get('meta', 'viewed_notifications_analytics').then(s => s && setViewedIds(new Set(s)));
    IndexedDBService.get('meta', 'notifications_cache').then(c => c && notifications.length === 0 && setNotifications(c));
  }, []);

  const load = useCallback(async (isInit = false) => {
    if (notifications.length === 0) setLoading(true);
    try {
      const all = await fetchNotifications();
      const filtered = filterNotificationsByFaculty(all, subscribedAssociations);
      setNotifications(filtered);
      if (isInit || subscribedAssociations.length > 0) IndexedDBService.set('meta', 'notifications_cache', filtered);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [notifications.length, subscribedAssociations]);

  useEffect(() => {
    if (!settingsLoading) { load(true); const id = setInterval(load, 300000); return () => clearInterval(id); }
  }, [load, settingsLoading]);

  const toggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && notifications.length > 0) {
      const nr = new Set(readIds); notifications.forEach(n => nr.add(n.id));
      setReadIds(nr); IndexedDBService.set('meta', 'read_notifications', Array.from(nr));
    }
  };

  const markVisible = (id: string) => {
    if (viewedIds.has(id)) return;
    trackNotificationsViewed([id]);
    setViewedIds(p => { const n = new Set(p); n.add(id); IndexedDBService.set('meta', 'viewed_notifications_analytics', Array.from(n)); return n; });
  };

  return { isOpen, setIsOpen, notifications, loading, readIds, viewedIds, toggle, markVisible, settingsLoading, load };
}
