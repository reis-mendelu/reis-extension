import { MapPin, ExternalLink, Clock } from 'lucide-react';
import { CATEGORY_ICON } from '../../data/eventCategories';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import { parseEventDate } from './eventHelpers';
import { EventRsvp } from './EventRsvp';
import type { MapEvent } from '../../types/events';

// Bottom-left detail body for a selected society event. Minimal and info-first:
// a small society avatar + title + host, then the facts (when / what / where),
// then the social block (attendance + Going/Interested RSVP) and More info. No
// decorative colour band — the avatar carries the brand, the text carries the job.
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
      <div className="space-y-3 p-3">
        {/* identity: avatar + title + host */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-base-300"
            style={{ backgroundColor: soc.color }}
          >
            {soc.logo
              ? <img src={soc.logo} alt="" className="h-full w-full object-cover" />
              : <span className="text-sm font-extrabold text-white">{soc.glyph}</span>}
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-bold leading-tight text-base-content">{event.title}</h3>
            <span className="text-xs text-base-content/60">{t('map.hostedBy')} {soc.shortName}</span>
          </div>
        </div>

        {/* the facts */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <Clock size={13} className="flex-shrink-0" />
            <span>{dateLabel}{event.time ? ` · ${event.time}` : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <CategoryIcon size={13} className="flex-shrink-0" />
            <span>{t(`map.category.${event.category}`)}</span>
          </div>
          {event.roomCode ? (
            <button
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              onClick={() => focusRoom(event.roomCode!)}
            >
              <MapPin size={13} className="flex-shrink-0" /> {event.roomCode}
            </button>
          ) : event.location ? (
            <div className="flex items-center gap-1.5 text-sm text-base-content/70">
              <MapPin size={13} className="flex-shrink-0" /> {event.location}
            </div>
          ) : null}
        </div>

        <div className="border-t border-base-300 pt-3">
          <EventRsvp eventId={event.id} accent={soc.color} />
        </div>

        {event.url && (
          <a
            href={event.url} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary btn-sm btn-block"
          >
            {t('map.moreInfo')} <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
