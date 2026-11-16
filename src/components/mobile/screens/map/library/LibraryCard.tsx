import { useEffect, useRef } from 'react';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { RoomDirections } from '../../../../CampusMap/RoomDirections';
import { LIBRARY_ROOMS } from '../../../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { shownDay } from '../../../../../mobile/library/libraryDay';
import { RoomList } from './RoomList';
import { RoomHours } from './RoomHours';
import type { LibraryView } from './libraryOf';

/**
 * The library as one place in the map's panel (phone sheet and iPad rail): its
 * six rooms in one list by size, or one room with its hours. Where it is comes
 * first, because "Studovny knihovny" alone never told a student where to walk.
 * The day it is about is today while today can still be booked, otherwise the
 * next weekday, and the card says so instead of calling every room full.
 */
export function LibraryCard({ view, flush }: { view: LibraryView; flush?: boolean }) {
  const { t, language } = useTranslation();
  const offline = useLibraryStore((s) => s.status === 'offline');
  const room = LIBRARY_ROOMS.find((r) => r.featureId === view.featureId) ?? null;
  // A room opened from far down the list kept the list's scroll, so its day
  // chips started off-screen: each view starts at its top.
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = top.current?.closest<HTMLElement>('.overflow-y-auto');
    if (scroller) scroller.scrollTop = 0;
  }, [view.featureId]);
  const now = new Date();
  const shown = shownDay(now);
  const shownLabel = new Date(`${shown.day}T12:00:00`).toLocaleDateString(
    language === 'cz' ? 'cs' : 'en',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
    }
  );
  return (
    <div ref={top} data-testid="library-card" className={`space-y-3 ${flush ? 'px-5' : 'px-4'}`}>
      <p className="text-sm text-base-content/70">
        {room
          ? `${room.seats === 1 ? t('mobile.library.seatsOne') : t('mobile.library.seats', { n: room.seats })} · ${t('mobile.library.place')}`
          : t('mobile.library.place')}
      </p>
      {!room && !shown.today && (
        <p role="status" className="rounded-xl bg-warning/15 px-3 py-2 text-sm text-base-content">
          {t('mobile.library.movedOn', { day: shownLabel })}
        </p>
      )}
      {!room && offline && (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.offline')}
        </p>
      )}
      {room ? (
        <>
          <RoomHours key={room.featureId} room={room} firstDay={shown.day} now={now} />
          <RoomDirections />
        </>
      ) : (
        <>
          <p className="text-xs text-base-content/70">{t('mobile.library.pickRoom')}</p>
          <RoomList day={shown.day} now={now} />
        </>
      )}
    </div>
  );
}
