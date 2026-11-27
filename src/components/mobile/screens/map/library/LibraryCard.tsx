import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useScreenSignal } from '../../../../../hooks/useScreenSignal';
import { cardPick, useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { DAILY_CAP } from '../../../../../mobile/library/slots';
import { bookedOn } from '../../../../../mobile/library/bookingService';
import {
  holidayOf,
  isoDay,
  lessonHours,
  weekdaysFrom,
} from '../../../../../mobile/library/libraryDay';
import {
  hourCells,
  rangeOf,
  roomsFreeFor,
  toggleHour,
  withOwnBookings,
} from '../../../../../mobile/library/libraryHours';
import { MyBookings } from './MyBookings';
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
  useScreenSignal('screen_library');
  const { t, language } = useTranslation();
  const raw = useLibraryStore((s) => s.blocks);
  const status = useLibraryStore((s) => s.status);
  const storeDay = useLibraryStore((s) => s.day);
  const storePicked = useLibraryStore((s) => s.picked);
  const lessons = useAppStore((s) => s.schedule.data);
  const mine = useAppStore((s) => s.customEvents);
  // The student's own bookings count as taken: the library shows a fresh one
  // as free for minutes.
  const blocks = useMemo(() => withOwnBookings(raw, mine), [raw, mine]);
  const now = new Date();
  const first = isoDay(now);
  const { day, picked } = cardPick({ day: storeDay, picked: storePicked }, now);
  // Five weekdays from today; a later day (a booking up to a week ahead) starts
  // the row itself, so the chosen day always has its chip.
  const fromToday = weekdaysFrom(first);
  const days = fromToday.includes(day) ? fromToday : weekdaysFrom(day);
  const holiday = holidayOf(day, language);
  const known = anyAnswer(blocks);
  const cells = known ? hourCells(blocks, day, now, lessonHours(lessons, day)) : [];
  const left = Math.max(0, DAILY_CAP - bookedOn(mine, day));
  const fits = (hours: number[]) => roomsFreeFor(blocks, day, now, hours).length > 0;
  // A pick that lost its last free room (booked meanwhile), or no longer fits
  // what is left of the daily cap (an extension used it), starts over.
  const sel = picked.length && picked.length <= left && fits(picked) ? picked : [];
  const span = rangeOf(sel);
  // Hours already gone are not drawn: at lunchtime they were half the grid, and the
  // answer sat below them.
  const open = cells.filter((c) => c.state !== 'past');
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

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
      <MyBookings day={day} />
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
        // The library takes 10–20 s to answer. A line of text alone read as
        // nothing happening; the grid's shape says what is coming.
        <div className="space-y-2">
          <p role="status" className="flex items-center gap-2 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            {t('mobile.library.loading')}
          </p>
          <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="skeleton h-11 rounded-xl" />
            ))}
          </div>
        </div>
      ) : open.length === 0 ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.dayOver')}
        </p>
      ) : (
        <>
          {left > 0 && (
            // Always in the same place and always two lines tall (`min-h-10`), whichever
            // text it holds, so the grid does not move under the finger between the first
            // tap and the second. A student who needs three hours books one without it
            // (nothing else says hours can be added). Once the pick has used up what is
            // left of the day it says so instead of inviting a tap that would do nothing.
            <p className="min-h-10 text-sm text-base-content/70">
              {span
                ? t(sel.length >= left ? 'mobile.library.pickedMax' : 'mobile.library.pickedHint', {
                    time: `${hh(span.from)}–${hh(span.to)}`,
                    n: sel.length,
                  })
                : t('mobile.library.pickHint', { cap: left })}
            </p>
          )}
          <HourGrid
            cells={open}
            picked={sel}
            onTap={(h) =>
              // The day is pinned with the pick, so a pick never moves to another day.
              useLibraryStore.setState({ day, picked: toggleHour(sel, h, fits, left) })
            }
          />
          {cells.some((c) => c.state === 'unknown') && (
            <p role="status" className="text-xs text-base-content/70">
              {t('mobile.library.someUnknown')}
            </p>
          )}
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
