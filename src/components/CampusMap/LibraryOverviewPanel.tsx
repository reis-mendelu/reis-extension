import { Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { LIBRARY_ROOMS } from '@/data/map/libraryRooms';
import { bookableRangesToday } from '@/services/library/nextSlot';
import type { LibraryRoom } from '@/types/library';
import { statusLabel } from './libraryStatus';

// A room is "solo" (just you, or a study partner) when it holds at most two
// people; everything larger is a group room. This is the axis the student asks
// about first — am I booking a private booth or a room others join?
function isSolo(room: LibraryRoom): boolean {
  return typeof room.capacity === 'number' && room.capacity <= 2;
}

function capacityLabel(room: LibraryRoom): string {
  return Array.isArray(room.capacity)
    ? `${room.capacity[0]}–${room.capacity[1]}`
    : `${room.capacity}`;
}

function RoomRow({ room }: { room: LibraryRoom }) {
  const { t, language } = useTranslation();
  const availability = useAppStore((s) => s.libraryAvailability[room.staffGuid]);
  const now = new Date();
  const roomName = language === 'en' ? room.service : room.nameCs;
  const ranges = availability
    ? bookableRangesToday(availability.blocks, room.leadMinutes, now)
    : [];
  // For rooms with nothing today, fall back to the shared status line (either a
  // future-day slot or "fully booked") so the row never reads as blank.
  const status = statusLabel(room, availability, now, t, language);

  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <a
          href={room.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-hover font-semibold text-base-content"
        >
          {roomName}
        </a>
        <span className="shrink-0 text-[11px] text-base-content/50">
          {capacityLabel(room)}&nbsp;{t('map.libraryPeople')}
        </span>
      </div>
      {ranges.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {ranges.map((r) => (
            <span
              key={r.start}
              className="badge badge-sm badge-success gap-1 font-medium tabular-nums"
            >
              <Clock size={11} strokeWidth={2.5} aria-hidden="true" />
              {new Date(r.start).getHours()}–{new Date(r.end).getHours()}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-base-content/50">{status.known ? status.text : '—'}</p>
      )}
    </li>
  );
}

// The library pin opens this: a single-glance overview of every study room and
// what a student can still book *today*. Rooms are split by the question they
// ask first — "just me, or a group?" — and each row shows the hour windows that
// are open. The room name is the booking link.
export function LibraryOverviewPanel() {
  const { t } = useTranslation();
  const solo = LIBRARY_ROOMS.filter(isSolo);
  const group = LIBRARY_ROOMS.filter((r) => !isSolo(r));

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="space-y-0.5">
        <h3 className="font-bold text-base-content">{t('map.studyRooms')}</h3>
        <p className="text-xs text-base-content/60">{t('map.libraryToday')}</p>
      </div>

      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-base-content/40">
          {t('map.librarySoloSection')}
        </p>
        <ul className="space-y-2.5">
          {solo.map((room) => (
            <RoomRow key={room.staffGuid} room={room} />
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-base-content/40">
          {t('map.libraryGroupSection')}
        </p>
        <ul className="space-y-2.5">
          {group.map((room) => (
            <RoomRow key={room.staffGuid} room={room} />
          ))}
        </ul>
      </section>

      <p className="border-t border-base-300 pt-2 text-[11px] text-base-content/50">
        {t('map.libraryRulesShort')}
      </p>
    </div>
  );
}
