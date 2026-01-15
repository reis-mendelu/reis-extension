import { useState, useEffect, useRef } from 'react';
import { Bell, Users, X } from 'lucide-react';
import type { SpolekNotification } from '../services/spolky';
import { fetchNotifications, trackNotificationsViewed, trackNotificationClick } from '../services/spolky';
import { isNotificationsEnabled } from '../utils/devFeatures';

interface NotificationFeedProps {
  className?: string;
}

interface NotificationFeedProps {
  className?: string;
}

export function NotificationFeed({ className = '' }: NotificationFeedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SpolekNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('reis_read_notifications');
    return new Set(saved ? JSON.parse(saved) : []);
  });
  const hasTrackedViews = useRef(false);

  // Load notifications ONCE on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('[NotificationFeed] Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // Dev Feature Flag: Hide notifications unless enabled
  if (!isNotificationsEnabled()) return null;

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
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover */}
          <div className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold text-base-content">Novinky</h3>
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
        </>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: SpolekNotification;
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  // Use spolky icon for non-academic notifications
  const assocId = notification.associationId || 'admin';
  const isAcademic = assocId.startsWith('academic_');
  const isAdmin = assocId === 'admin';

  // Get icon URL for spolky
  // If admin, we don't want to try fetching a 404 image
  const iconUrl = (isAcademic || isAdmin)
    ? null 
    : `https://reismendelu.app/static/spolky/${assocId}.jpg`;

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
      className="w-full p-4 hover:bg-base-200 transition-colors text-left flex gap-3"
    >
      <div className="flex-shrink-0 mt-1">
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
        <div className="font-medium text-base-content line-clamp-1">
          {notification.title}
        </div>
        
        {/* Only show body if it differs from title */}
        {notification.body && notification.body !== notification.title && (
          <div className="text-sm text-base-content/70 line-clamp-2 mt-1">
            {notification.body}
          </div>
        )}
        
        <div className="text-xs text-base-content/50 mt-2">
          {formatDate(notification.createdAt)}
        </div>
      </div>
    </button>
  );
}
