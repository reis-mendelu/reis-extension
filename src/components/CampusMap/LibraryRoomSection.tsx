import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { libraryRoomsByPlaceId } from '@/data/map/libraryRooms';
import { statusLabel } from './libraryStatus';

export function LibraryRoomSection({ placeId }: { placeId: number }) {
  const { t, language } = useTranslation();
  const availability = useAppStore((s) => s.libraryAvailability);
  const rooms = libraryRoomsByPlaceId(placeId);
  if (!rooms.length) return null;
  const now = new Date();

  return (
    <div className="space-y-2 border-t border-base-300 pt-2">
      {rooms.map((room) => {
        const avail = availability[room.staffGuid];
        const status = statusLabel(room, avail, now, t, language);
        const cap = Array.isArray(room.capacity) ? `${room.capacity[0]}–${room.capacity[1]}` : room.capacity;
        // Czech resource name for cz, the English service title for en.
        const roomName = language === 'en' ? room.service : room.nameCs;
        return (
          <div key={room.staffGuid} className="space-y-1">
            <p className="text-sm font-semibold text-base-content">{roomName}</p>
            <p className="text-xs text-base-content/60">
              {t('map.libraryCapacity')}: {cap} {t('map.libraryPeople')} · {t('map.libraryAmenities')}
            </p>
            {status.known && (
              <span className={`badge badge-sm ${status.free ? 'badge-success' : 'badge-ghost'}`}>{status.text}</span>
            )}
            <a
              href={room.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary block text-sm"
            >
              {t('map.libraryReserve')}
            </a>
          </div>
        );
      })}
      <p className="text-[11px] text-base-content/50">{t('map.libraryRulesShort')}</p>
    </div>
  );
}
