import { useState } from 'react';
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
import { deletePost } from '../../api/societyPosts';
import type { MapEvent } from '../../types/events';

const INDEX = roomsIndexJson as RoomIndexEntry[];

// Bottom-left detail body for a selected society event. Minimal and info-first:
// a small society avatar + title + host, then the facts (when / what / where),
// then the social block (attendance + Going/Interested RSVP) and More info. No
// decorative colour band — the avatar carries the brand, the text carries the job.
export function EventDetailCard({ event }: { event: MapEvent }) {
  const focusRoom = useAppStore((s) => s.focusRoomByCode);
  const mode = useAppStore((s) => s.mapMode);
  const myAssoc = useAppStore((s) => s.adminAssociationId);
  const openComposer = useAppStore((s) => s.openComposer);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const clearMapSelection = useAppStore((s) => s.clearMapSelection);
  const { t, language } = useTranslation();
  const soc = societyById(event.societyId);
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const dateLabel = parseEventDate(event.date).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const mine = mode === 'society' && event.societyId === myAssoc;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeEvent = async () => {
    if (deleting) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    const res = await deletePost(event.id);
    setDeleting(false);
    if (res.error) {
      setConfirming(false);
      return;
    }
    clearMapSelection();
    await loadSocietyPosts();
  };

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
            <div className="flex items-center gap-1.5 text-sm text-base-content/70">
              <MapPin size={13} className="flex-shrink-0" /> {event.location}
            </div>
          ) : null}
        </div>

        <div className="border-t border-base-300 pt-3">
          <EventRsvp eventId={event.id} accent={soc.color} />
        </div>

        {mine && (
          <div className="flex gap-2 border-t border-base-300 pt-3">
            <button
              type="button"
              className="btn btn-outline btn-sm flex-1"
              onClick={() => openComposer(event.id)}
            >
              {t('map.edit')}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-error btn-sm flex-1"
              disabled={deleting}
              onClick={removeEvent}
            >
              {confirming ? t('map.deleteConfirm') : t('map.delete')}
            </button>
          </div>
        )}

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
