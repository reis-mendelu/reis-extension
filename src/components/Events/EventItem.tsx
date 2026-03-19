import type { MendeluEvent } from '../../types/events';
import { ORGANIZERS } from '../../types/events';
import { MapPin } from 'lucide-react';

interface EventItemProps {
  event: MendeluEvent;
  onClick: () => void;
}

export function EventItem({ event, onClick }: EventItemProps) {
  const org = ORGANIZERS[event.organizerKey];

  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors flex gap-3 items-start">
      <div className="flex-shrink-0 mt-1 w-2 h-2 rounded-full" style={{ backgroundColor: org.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-base-content line-clamp-2">{event.title}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-base-content/60">
          <span>{event.date}{event.endDate ? ` – ${event.endDate}` : ''}</span>
          {event.time && <span>· {event.time}</span>}
        </div>
        {event.location && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-base-content/50">
            <MapPin size={10} />
            <span className="truncate">{event.location}</span>
          </div>
        )}
      </div>
    </button>
  );
}
