import { MapPin, ExternalLink, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import { parseEventDate } from './eventHelpers';
import type { MapEvent } from '../../types/events';

// Bottom-left detail body for a selected society event. Reuses the slot rooms
// and places already use, so there's one consistent place to look.
export function EventDetailCard({ event }: { event: MapEvent }) {
  const focusRoom = useAppStore((s) => s.focusRoomByCode);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const allEvents = useAppStore((s) => s.mapEvents);
  const { t, language } = useTranslation();
  const soc = societyById(event.societyId);
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const dateLabel = parseEventDate(event.date).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'long',
  });
  const siblings = event.coord
    ? allEvents.filter((e) => e.id !== event.id && e.coord && e.coord[0] === event.coord![0] && e.coord[1] === event.coord![1])
    : [];

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <div className="flex h-16 items-center justify-center" style={{ backgroundColor: soc.color }}>
        {event.imageUrl
          ? <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
          : soc.logo
            ? <img src={soc.logo} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/70" />
            : <span className="text-2xl font-extrabold text-white">{soc.glyph}</span>}
      </div>
      <div className="space-y-2 p-3">
        <h3 className="font-bold leading-tight text-base-content">{event.title}</h3>
        <div className="flex items-center gap-1.5 text-sm text-base-content/70">
          <Clock size={13} /> <span>{dateLabel}{event.time ? ` · ${event.time}` : ''}</span>
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
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold"
          style={{ color: soc.color }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: soc.color }} />
          {soc.name}
        </span>
        {siblings.length > 0 && (
          <button className="block text-xs text-base-content/60 hover:underline" onClick={() => setTab('events')}>
            +{siblings.length} {t('map.moreHere')}
          </button>
        )}
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
