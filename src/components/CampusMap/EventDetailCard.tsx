import { MapPin, ExternalLink, Clock } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { roomCodeToName } from './mapHelpers';
import type { RoomIndexEntry } from '../../types/campusMap';
import { parseEventDate } from './eventHelpers';
import { EventRsvp } from './EventRsvp';
import type { MapEvent } from '../../types/events';

const INDEX = roomsIndexJson as RoomIndexEntry[];

// Bottom-left detail body for a selected event — a read-only preview shown to
// students and societies alike: a small society avatar + title + host, then the
// facts (when / what / where), the social block (attendance + RSVP), and More
// info. A society edits/deletes its own events from the "Moje akce" panel, so
// this card carries no authoring controls (keeps management in one place).
export function EventDetailCard({ event }: { event: MapEvent }) {
  const focusRoom = useAppStore((s) => s.focusRoomByCode);
  const { t, language } = useTranslation();
  const soc = societyById(event.societyId);
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const dateLabel = parseEventDate(event.date).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
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
            {soc.logo ? (
              <img src={soc.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-extrabold text-white">{soc.glyph}</span>
            )}
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-bold leading-tight text-base-content">
              {event.title}
            </h3>
            <span className="text-xs text-base-content/60">
              {t('map.hostedBy')} {soc.shortName}
            </span>
          </div>
        </div>

        {/* the facts */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <Clock size={13} className="flex-shrink-0" />
            <span>
              {dateLabel}
              {event.time ? ` · ${event.time}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <img
              src={CATEGORY_EMOJI_SRC[event.category]}
              alt=""
              className="h-4 w-4 flex-shrink-0"
            />
            <span>{t(`map.category.${event.category}`)}</span>
          </div>
          {event.roomCode ? (
            <button
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              onClick={() => focusRoom(event.roomCode!)}
            >
              <MapPin size={13} className="flex-shrink-0" /> {roomCodeToName(event.roomCode, INDEX)}
            </button>
          ) : event.location ? (
            event.coord ? (
              // Off-campus venue: open it in Google Maps so the student can
              // navigate there. coord is [lng, lat]; Maps wants lat,lng.
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${event.coord[1]},${event.coord[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <MapPin size={13} className="flex-shrink-0" /> {event.location}
                <ExternalLink size={11} className="flex-shrink-0 opacity-60" />
              </a>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-base-content/70">
                <MapPin size={13} className="flex-shrink-0" /> {event.location}
              </div>
            )
          ) : null}
        </div>

        <div className="border-t border-base-300 pt-3">
          <EventRsvp eventId={event.id} accent={soc.color} />
        </div>

        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm btn-block"
          >
            {t('map.moreInfo')} <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
