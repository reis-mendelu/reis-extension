import { useEffect, useRef } from 'react';
import { Newspaper } from 'lucide-react';
import { useEventsFeed } from '../hooks/useEventsFeed';
import { EventsDropdown } from './Events/EventsDropdown';

export function EventsFeed({ className = '' }: { className?: string }) {
  const { isOpen, setIsOpen, events, loading, toggle } = useEventsFeed();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !(e.target as Element).closest('button[aria-label="Events"]')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleEsc); document.removeEventListener('mousedown', handleClick); };
  }, [isOpen, setIsOpen]);

  return (
    <div className={`relative ${className}`}>
      <button onClick={toggle} className="relative p-2 hover:bg-base-300 rounded-lg transition-colors" aria-label="Events">
        <Newspaper size={20} className="text-base-content/70" />
      </button>
      {isOpen && <EventsDropdown dropdownRef={dropdownRef} events={events} loading={loading} onClose={() => setIsOpen(false)} />}
    </div>
  );
}
