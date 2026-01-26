import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationFeed } from '../hooks/useNotificationFeed';
import { NotificationDropdown } from './Notifications/NotificationDropdown';

export function NotificationFeed({ className = '' }: { className?: string }) {
  const s = useNotificationFeed();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!s.isOpen) return;
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && s.setIsOpen(false);
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !(e.target as Element).closest('button[aria-label="Notifications"]')) {
        s.setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleEsc); document.removeEventListener('mousedown', handleClick); };
  }, [s.isOpen]);

  const unreadCount = s.notifications.filter(n => !s.readIds.has(n.id)).length;

  return (
    <div className={`relative ${className}`}>
      <button onClick={s.toggle} className="relative p-2 hover:bg-base-300 rounded-lg transition-colors" aria-label="Notifications">
        <Bell size={20} className="text-base-content/70" />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-error text-error-content text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {s.isOpen && <NotificationDropdown dropdownRef={dropdownRef} notifications={s.notifications} loading={s.loading} onClose={() => s.setIsOpen(false)} onVisible={s.markVisible} />}
    </div>
  );
}
