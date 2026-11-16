import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { DAILY_CAP } from '../../../../../mobile/library/slots';
import { bookedOn } from '../../../../../mobile/library/bookingService';
import {
  holidayOf,
  isoDay,
  lessonHours,
  shownDay,
  weekdaysFrom,
} from '../../../../../mobile/library/libraryDay';
import {
  hourCells,
  rangeOf,
  roomsFreeFor,
  toggleHour,
} from '../../../../../mobile/library/libraryHours';
import { DayChips } from './DayChips';
import { HourGrid } from './HourGrid';
import { FreeRooms } from './FreeRooms';
import type { LibraryView } from './libraryOf';

/**
 * The library as one place in the map's panel (phone sheet and iPad rail).
 * Time first: a day, then the hours, then the rooms free for all of them, then
 * book (Dominik, 2026-11-16: "what I care about is which study room is open at
 * that time"). As little text as the screen can carry: where it is, and the
 * answer; no legends.
 */
export function LibraryCard({ view, flush }: { view: LibraryView; flush?: boolean }) {
  const { t, language } = useTranslation();
  const blocks = useLibraryStore((s) => s.blocks);
  const status = useLibraryStore((s) => s.status);
  const storeDay = useLibraryStore((s) => s.day);
  const picked = useLibraryStore((s) => s.picked);
  const lessons = useAppStore((s) => s.schedule.data);
  const mine = useAppStore((s) => s.customEvents);
  const now = new Date();
  const day = storeDay ?? shownDay(now);
  const first = isoDay(now);
  const days = weekdaysFrom(first <= day ? first : day);
  const holiday = holidayOf(day, language);
  const known = anyAnswer(blocks);
  const cells = known ? hourCells(blocks, day, now, lessonHours(lessons, day)) : [];
  const left = Math.max(0, DAILY_CAP - bookedOn(mine, day));
  const fits = (hours: number[]) => roomsFreeFor(blocks, day, now, hours).length > 0;
  // A pick that lost its last free room (booked meanwhile) starts over.
  const sel = picked.length && fits(picked) ? picked : [];
  const span = rangeOf(sel);

  // Each day and each pick starts at the top of the panel, not where the
  // previous scroll left it.
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = top.current?.closest<HTMLElement>('.overflow-y-auto');
    if (scroller) scroller.scrollTop = 0;
  }, [day]);

  return (
    <div ref={top} data-testid="library-card" className={`space-y-3 ${flush ? 'px-5' : 'px-4'}`}>
      <p className="text-sm text-base-content/70">{t('mobile.library.place')}</p>
      <DayChips
        days={days}
        day={day}
        now={now}
        closed={(d) => holidayOf(d, language) !== null}
        onPick={(d) => useLibraryStore.getState().setDay(d)}
      />
      {holiday ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.holiday', { name: holiday })}
        </p>
      ) : status === 'offline' ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.offline')}
        </p>
      ) : !known ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.loading')}
        </p>
      ) : (
        <>
          <HourGrid
            cells={cells}
            picked={sel}
            onTap={(h) => useLibraryStore.getState().setPicked(toggleHour(sel, h, fits, left))}
          />
          {left === 0 && (
            <p className="text-xs text-base-content/70">
              {t('mobile.library.capReached', { cap: DAILY_CAP })}
            </p>
          )}
          {span && (
            <FreeRooms
              rooms={roomsFreeFor(blocks, day, now, sel)}
              day={day}
              span={span}
              chosen={view.featureId}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Whether the library has answered for at least one room. */
const anyAnswer = (blocks: Record<number, unknown>) =>
  Object.values(blocks).some((b) => Array.isArray(b));
