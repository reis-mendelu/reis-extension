import { useState, useEffect, useRef } from 'react';
import { Bell, Users, X } from 'lucide-react';
import type { SpolekNotification } from '../services/spolky';
import { fetchNotifications, trackNotificationsViewed, trackNotificationClick, filterNotificationsByFaculty } from '../services/spolky';
import { useSpolkySettings } from '../hooks/useSpolkySettings';

interface NotificationFeedProps {
  className?: string;
  isSidebarCollapsed?: boolean;
}

export function NotificationFeed({ className = '', isSidebarCollapsed = false }: NotificationFeedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SpolekNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('reis_read_notifications');
    return new Set(saved ? JSON.parse(saved) : []);
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasTrackedViews = useRef(false);
  const { subscribedAssociations } = useSpolkySettings();

  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Load notifications on mount and when dependencies change
  useEffect(() => {
    loadNotifications();
    
    // Auto-refresh every 5 minutes
    const intervalId = setInterval(() => {
      loadNotifications();
    }, REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [subscribedAssociations]); // Reload when subscriptions change

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [subscribedAssociations]);

  const loadNotifications = async () => {
    // Only show loading if we don't have cached data
    if (notifications.length === 0) {
      setLoading(true);
    }
    
    try {
      const allNotifications = await fetchNotifications();
      
      // Filter by subscribed associations (includes home faculty and ESN by default)
      const filteredData = filterNotificationsByFaculty(
        allNotifications, 
        subscribedAssociations
      );
      setNotifications(filteredData);
      
      // Cache in localStorage for instant loading next time
      localStorage.setItem('reis_notifications_cache', JSON.stringify(filteredData));
    } catch (error) {
      console.error('[NotificationFeed] Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleOpen = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (newIsOpen && notifications.length > 0) {
      // Mark all current as read locally
      const newReadIds = new Set(readIds);
      notifications.forEach(n => newReadIds.add(n.id));
      setReadIds(newReadIds);
      localStorage.setItem('reis_read_notifications', JSON.stringify(Array.from(newReadIds)));

      // Track views (analytics)
      if (!hasTrackedViews.current) {
         hasTrackedViews.current = true;
         const spolkyNotifications = notifications.filter(n => !n.associationId?.startsWith('academic_'));
         if (spolkyNotifications.length > 0) {
           trackNotificationsViewed(spolkyNotifications.map(n => n.id));
         }
      }
    }
  };

  const handleNotificationClick = (notification: SpolekNotification) => {
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
          className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[500px] overflow-hidden flex flex-col"
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
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
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
