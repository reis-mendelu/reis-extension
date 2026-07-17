import { useMemo, useState, type ReactNode } from 'react';
import { Library, Clock, Users, Check, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { LIBRARY_ROOMS, LIBRARY_BOOKING_HOME } from '@/data/map/libraryRooms';
import { bookableRangesOnDay, isRoomFreeAt } from '@/services/library/nextSlot';
import { pickableDays, openStartHours } from '@/services/library/availabilityView';
import type { LibraryRoom, RoomAvailability } from '@/types/library';
import { LibrarySlotPicker } from './LibrarySlotPicker';

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

function RoomRow({
  room,
  availability,
  day,
  hour,
  now,
}: {
  room: LibraryRoom;
  availability: RoomAvailability | undefined;
  day: Date;
  hour: number | null;
  now: Date;
}) {
  const { t, language } = useTranslation();
  const roomName = language === 'en' ? room.service : room.nameCs;

  // The right-hand status, one badge so each room stays on a single line:
  //   • not loaded yet → neutral "—" (never blindly claim busy)
  //   • an exact hour is picked → free/busy answer for that slot
  //   • otherwise → the picked day's open windows, or "full" if none
  let status: ReactNode;
  if (!availability) {
    status = <span className="badge badge-sm badge-ghost text-base-content/30">—</span>;
  } else if (hour !== null) {
    const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
    const free = isRoomFreeAt(availability.blocks, room.leadMinutes, slot, now);
    status = free ? (
      <span className="badge badge-sm badge-success gap-1 whitespace-nowrap font-medium">
        <Check size={11} strokeWidth={3} aria-hidden="true" />
        {t('map.libraryFreeAt')}
      </span>
    ) : (
      <span className="badge badge-sm badge-ghost whitespace-nowrap text-base-content/40">
        {t('map.libraryBusyAt')}
      </span>
    );
  } else {
    const ranges = bookableRangesOnDay(availability.blocks, room.leadMinutes, day, now);
    status =
      ranges.length > 0 ? (
        <span className="badge badge-sm badge-success gap-1 whitespace-nowrap font-medium tabular-nums">
          <Clock size={11} strokeWidth={2.5} aria-hidden="true" />
          {ranges
            .map((r) => `${new Date(r.start).getHours()}–${new Date(r.end).getHours()}`)
            .join(' · ')}
        </span>
      ) : (
        <span className="badge badge-sm badge-ghost text-base-content/40">
          {t('map.libraryFullShort')}
        </span>
      );
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-base-content">{roomName}</span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-base-content/40">
          <Users size={11} aria-hidden="true" />
          {capacityLabel(room)}
        </span>
      </span>
      {status}
    </li>
  );
}

// The library pin opens this: a compact overview of every study room. The rooms
// are free to book and split by the question a student asks first — "just me,
// or a group?". A day + hour picker checks any specific slot; by default each
// row shows the picked day's open hours. One button books on the Outlook page.
export function LibraryOverviewPanel() {
  const { t, language } = useTranslation();
  const availabilityMap = useAppStore((s) => s.libraryAvailability);
  const now = useMemo(() => new Date(), []);
  const loc = language === 'cz' ? 'cs' : language;
  const [dayIdx, setDayIdx] = useState(0);
  const [hour, setHour] = useState<number | null>(null);

  const unionBlocks = useMemo(
    () => LIBRARY_ROOMS.flatMap((r) => availabilityMap[r.staffGuid]?.blocks ?? []),
    [availabilityMap]
  );
  const days = useMemo(() => pickableDays(unionBlocks, now), [unionBlocks, now]);
  const day = days[Math.min(dayIdx, days.length - 1)] ?? now;
  const hours = useMemo(() => openStartHours(unionBlocks, day), [unionBlocks, day]);
  // If the picked hour isn't open on the selected day, fall back to "any time"
  // rather than showing every room as busy at a slot that doesn't exist.
  const activeHour = hour !== null && hours.includes(hour) ? hour : null;

  const solo = LIBRARY_ROOMS.filter(isSolo);
  const group = LIBRARY_ROOMS.filter((r) => !isSolo(r));
  const renderRow = (room: LibraryRoom) => (
    <RoomRow
      key={room.staffGuid}
      room={room}
      availability={availabilityMap[room.staffGuid]}
      day={day}
      hour={activeHour}
      now={now}
    />
  );

  return (
    <div className="max-h-[80vh] overflow-y-auto overflow-x-hidden rounded-lg border border-base-300 bg-base-100">
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Library size={18} strokeWidth={2} className="shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="font-bold leading-tight text-base-content">
              {t('map.libraryPanelTitle')}
            </h3>
            <span className="text-xs text-base-content/60">{t('map.libraryFreeNote')}</span>
          </div>
        </div>

        {days.length > 0 && (
          <LibrarySlotPicker
            days={days}
            dayIdx={Math.min(dayIdx, days.length - 1)}
            onDay={setDayIdx}
            hours={hours}
            hour={activeHour}
            onHour={setHour}
            now={now}
            loc={loc}
          />
        )}

        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-base-content/40">
            {t('map.librarySoloSection')}
          </p>
          <ul className="space-y-1">{solo.map(renderRow)}</ul>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-base-content/40">
            {t('map.libraryGroupSection')}
          </p>
          <ul className="space-y-1">{group.map(renderRow)}</ul>
        </div>

        <a
          href={LIBRARY_BOOKING_HOME}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm btn-block"
        >
          {t('map.libraryBook')} <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
