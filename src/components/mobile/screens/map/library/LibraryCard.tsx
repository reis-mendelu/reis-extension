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
import { withOwnBookings } from '../../../../../mobile/library/libraryHours';
import {
  gridRows,
  growHours,
  tapCell,
  type CellState,
  type GridPick,
} from '../../../../../mobile/library/libraryGrid';
import { MyBookings } from './MyBookings';
import { DayChips } from './DayChips';
import { LibraryGrid } from './LibraryGrid';
import { SavedNote } from './SavedNote';
import { openLibrary } from './openLibrary';
import type { LibraryView } from './libraryOf';

/**
 * The library as one place in the map's panel (phone sheet and iPad rail).
 * A day, then a table of rooms and hours: tap a free cell, tap the "+" for more
 * hours, tap the check. Nobody reads text on it (Dominik, 2026-11-27), so the
 * only words are the place, the day and the rooms' names.
 */
export function LibraryCard({ view, flush }: { view: LibraryView; flush?: boolean }) {
  useScreenSignal('screen_library');
  const { t, language } = useTranslation();
  const raw = useLibraryStore((s) => s.blocks);
  const status = useLibraryStore((s) => s.status);
  const savedAt = useLibraryStore((s) => s.savedAt);
  const storeDay = useLibraryStore((s) => s.day);
  const storePicked = useLibraryStore((s) => s.picked);
  const storeRoom = useLibraryStore((s) => s.room);
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
  const rows = known ? gridRows(blocks, day, now, lessonHours(lessons, day), mine) : [];
  const left = Math.max(0, DAILY_CAP - bookedOn(mine, day));
  const stateOf = (room: number, hour: number): CellState =>
    rows.find((r) => r.hour === hour)?.cells[room] ?? 'taken';
  // A pick that lost a cell (booked meanwhile), or no longer fits what is left of
  // the daily cap (an extension used it), is dropped.
  const stored: GridPick | null =
    storeRoom !== null && picked.length ? { room: storeRoom, hours: picked } : null;
  const pick =
    stored &&
    stored.hours.length <= left &&
    stored.hours.every((h) => stateOf(stored.room, h) === 'free')
      ? stored
      : null;
  // A pick that stopped being valid is dropped from the store, not only hidden: a
  // later read that frees those cells again must not bring the old pick back.
  const lost = stored !== null && pick === null;
  useEffect(() => {
    if (lost) useLibraryStore.getState().clearPick();
  }, [lost]);

  const onTap = (room: number, hour: number) => {
    const next = tapCell(pick, room, hour, stateOf, left);
    // The day is pinned with the pick, so a pick never moves to another day.
    useLibraryStore.setState({ day, room: next?.room ?? null, picked: next?.hours ?? [] });
    // The first cell of a room closes the map in on it, so the student sees where it is.
    if (next && next.room !== pick?.room) openLibrary(next.room);
  };

  // Each day starts at the top of the panel, not where the previous scroll left it.
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
        // The library can take 10–20 s to answer. A line of text alone read as
        // nothing happening; the grid's shape says what is coming.
        <div className="space-y-2">
          <p role="status" className="flex items-center gap-2 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            {t('mobile.library.loading')}
          </p>
          <div className="grid grid-cols-6 gap-1" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="skeleton h-11 rounded-lg" />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.dayOver')}
        </p>
      ) : (
        <>
          {savedAt !== null && <SavedNote at={savedAt} loading={status === 'loading'} />}
          <LibraryGrid
            rows={rows}
            pick={pick}
            grow={growHours(pick, stateOf, left)}
            chosen={view.featureId}
            flush={flush}
            onTap={onTap}
          />
          {rows.some((r) => Object.values(r.cells).includes('unknown')) && (
            <p role="status" className="text-xs text-base-content/70">
              {t('mobile.library.someUnknown')}
            </p>
          )}
          {left === 0 && (
            <p className="text-xs text-base-content/70">
              {t('mobile.library.capReached', { cap: DAILY_CAP })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Whether the library has answered for at least one room. */
const anyAnswer = (blocks: Record<number, unknown>) =>
  Object.values(blocks).some((b) => Array.isArray(b));
