import { useState, useEffect, useRef } from 'react';
import { Bell, Users, X } from 'lucide-react';
import type { SpolekNotification } from '../services/spolky';
import { fetchNotifications, trackNotificationsViewed, trackNotificationClick, filterNotificationsByFaculty } from '../services/spolky';
import { useSpolkySettings } from '../hooks/useSpolkySettings';
import { IndexedDBService } from '../services/storage';

interface NotificationFeedProps {
  className?: string;
  isSidebarCollapsed?: boolean;
}

export function NotificationFeed({ className = '' }: NotificationFeedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SpolekNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { subscribedAssociations, isLoading: settingsLoading } = useSpolkySettings();

  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Load persisted state (read/viewed IDs and cached notifications) on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const [savedReadIds, savedViewedIds, cachedNotifications] = await Promise.all([
          IndexedDBService.get('meta', 'read_notifications'),
          IndexedDBService.get('meta', 'viewed_notifications_analytics'),
          IndexedDBService.get('meta', 'notifications_cache')
        ]);

        if (savedReadIds) {
           setReadIds(new Set(savedReadIds));
        }
        if (savedViewedIds) {
           setViewedIds(new Set(savedViewedIds));
        }
        // Only set notifications from cache if we haven't already fetched from network
        if (cachedNotifications && notifications.length === 0) {
           setNotifications(cachedNotifications);
        }
      } catch (err) {
        console.error('[NotificationFeed] Failed to load persisted state:', err);
      }
    };
    loadState();
  }, []);

  const loadNotifications = async (isInitialWithSettings = false) => {
    // Only show loading if we don't have existing data
    if (notifications.length === 0) {
      setLoading(true);
    }
    
    try {
      const allNotifications = await fetchNotifications();
      
      // If we are calling this with real settings, we can filter and cache
      const filteredData = filterNotificationsByFaculty(
        allNotifications, 
        subscribedAssociations
      );
      
      setNotifications(filteredData);
      
      // Only cache if we actually have settings loaded (to avoid caching an empty list due to race)
      if (isInitialWithSettings || subscribedAssociations.length > 0) {
         IndexedDBService.set('meta', 'notifications_cache', filteredData).catch(console.error);
      }
    } catch (error) {
      console.error('[NotificationFeed] Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load notifications when settings change and they are not loading
  useEffect(() => {
    if (settingsLoading) return;
    
    loadNotifications(true);
    
    // Auto-refresh every 5 minutes
    const intervalId = setInterval(() => {
      loadNotifications();
    }, REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [subscribedAssociations, settingsLoading]); 

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !settingsLoading) {
        loadNotifications();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [subscribedAssociations, settingsLoading]);

  // Handle Escape key and Click Outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      // If clicking outside the dropdown AND the toggle button (to avoid double-toggle)
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        // Also check if we clicked the bell button (which has its own handler)
        // We can do this by checking if the target is within the button
        !(event.target as Element).closest('button[aria-label="Notifications"]')
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationVisible = (id: string) => {
    if (!viewedIds.has(id)) {
      trackNotificationsViewed([id]);
      setViewedIds(prev => {
        const newSet = new Set(prev);
        newSet.add(id);
        IndexedDBService.set('meta', 'viewed_notifications_analytics', Array.from(newSet)).catch(console.error);
        return newSet;
      });
    }
  };

  const handleOpen = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (newIsOpen && notifications.length > 0) {
      // Mark all current as read locally (visual state)
      const newReadIds = new Set(readIds);
      notifications.forEach(n => newReadIds.add(n.id));
      setReadIds(newReadIds);
      IndexedDBService.set('meta', 'read_notifications', Array.from(newReadIds)).catch(console.error);
    }
  };

  const handleNotificationClick = (notification: SpolekNotification) => {
    // Track click regardless of view status, but checking if academic to be safe as per original logic if needed
    // Original logic: if (!notification.associationId?.startsWith('academic_')) trackNotificationClick(date)
    if (!notification.associationId?.startsWith('academic_')) {
      trackNotificationClick(notification.id);
    }
    
    if (notification.link) {
      window.open(notification.link, '_blank');
    }
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 hover:bg-base-300 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-base-content/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error text-error-content text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[320px] overflow-hidden flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold text-lg text-base-content">Novinky</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-base-300 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-4 text-center text-base-content/60">
                  Načítá se...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-base-content/60">
                  <Bell size={48} className="mx-auto mb-2 opacity-40" />
                  <p>Žádné nové novinky</p>
                </div>
              ) : (
                <div className="divide-y divide-base-300">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                      onVisible={() => handleNotificationVisible(notification.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: SpolekNotification;
  onClick: () => void;
  onVisible?: () => void;
}

function NotificationItem({ notification, onClick, onVisible }: NotificationItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!onVisible || !itemRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible();
            if (itemRef.current) {
                observer.unobserve(itemRef.current);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(itemRef.current);

    return () => {
      observer.disconnect();
    };
  }, [onVisible]);

  // Icon rendering logic
  const assocId = notification.associationId || 'admin';
  const isAcademic = assocId.startsWith('academic_');
  const isAdmin = assocId === 'admin';
  
  // Use local icons from public/spolky folder
  const iconUrl = (isAcademic || isAdmin)
    ? null 
    : `/spolky/${assocId}.jpg`;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return 'Dnes';
    } else if (diffHours < 48) {
      return 'Včera';
    } else {
      return `${date.getDate()}.${date.getMonth() + 1}.`;
    }
  };

  return (
    <button
      ref={itemRef}
      onClick={onClick}
      className="w-full p-4 hover:bg-base-200 transition-colors text-left flex items-center gap-3"
    >
      <div className="flex-shrink-0">
        {iconUrl ? (
          <img 
            src={iconUrl} 
            alt={assocId} 
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              // Fallback to Users icon if image fails
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback Icons */}
        <div className={iconUrl ? 'hidden' : ''}>
           {isAdmin ? (
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
               <Bell size={20} />
             </div>
           ) : (
             <Users size={24} className="text-primary" />
           )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {/* Title and Date in same row */}
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm text-base-content line-clamp-1 flex-1">
            {notification.title}
          </div>
          <div className="text-sm text-base-content flex-shrink-0">
            {formatDate(notification.createdAt)}
          </div>
        </div>
      </div>
    </button>
  );
}
