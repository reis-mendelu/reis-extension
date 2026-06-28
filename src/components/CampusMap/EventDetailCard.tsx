import { MapPin, ExternalLink, Clock } from 'lucide-react';
import { CATEGORY_ICON } from '../../data/eventCategories';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import { parseEventDate } from './eventHelpers';
import { EventDetailCover } from './EventDetailCover';
import { EventRsvp } from './EventRsvp';
import type { MapEvent } from '../../types/events';

// Bottom-left detail body for a selected society event — the "social" surface.
// Cover + host chip + when/where, then the attendance block (avatar stack, going
// counts, Going/Interested RSVP). The list rows stay compact; all social cues
// live here, one tap away.
export function EventDetailCard({ event }: { event: MapEvent }) {
  const focusRoom = useAppStore((s) => s.focusRoomByCode);
  const { t, language } = useTranslation();
  const soc = societyById(event.societyId);
  const CategoryIcon = CATEGORY_ICON[event.category];
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const dateLabel = parseEventDate(event.date).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'long',
  });

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <EventDetailCover event={event} society={soc} />
      <div className="space-y-2 p-3 pt-2">
        {/* host chip sits to the right of the overlapping avatar */}
        <div className="flex items-center justify-end">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold"
            style={{ color: soc.color }}
          >
            {t('map.hostedBy')} {soc.name}
          </span>
        </div>

        <h3 className="font-bold leading-tight text-base-content">{event.title}</h3>

        <div className="flex items-center gap-1.5 text-sm text-base-content/70">
          <Clock size={13} /> <span>{dateLabel}{event.time ? ` · ${event.time}` : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-base-content/70">
          <CategoryIcon size={13} style={{ color: soc.color }} />
          <span>{t(`map.category.${event.category}`)}</span>
        </div>
        {event.roomCode ? (
          <button
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            onClick={() => focusRoom(event.roomCode!)}
          >
            <MapPin size={13} /> {event.roomCode}
          </button>
        ) : event.location ? (
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <MapPin size={13} /> {event.location}
          </div>
        ) : null}

        <div className="border-t border-base-300 pt-2">
          <EventRsvp eventId={event.id} accent={soc.color} />
        </div>

        {event.url && (
          <a
            href={event.url} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary btn-sm btn-block mt-1"
          >
            {t('map.moreInfo')} <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
