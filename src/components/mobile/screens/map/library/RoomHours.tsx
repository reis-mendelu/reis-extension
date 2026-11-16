import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useWideViewport } from '../../../../../hooks/ui/useWideViewport';
import type { LibraryRoom } from '../../../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { DAILY_CAP } from '../../../../../mobile/library/slots';
import { bookedOn } from '../../../../../mobile/library/bookingService';
import {
  hourStates,
  lessonHours,
  nextFree,
  rangeOf,
  toggleHour,
  weekdaysFrom,
} from '../../../../../mobile/library/libraryDay';
import { LibraryConfirm } from '../../../sheets/LibraryConfirm';
import { HourGrid } from './HourGrid';
import { DayChips } from './DayChips';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * One room: five weekdays, that day's hours, and the stretch the student picks.
 * It opens on the day the list was about and never moves on its own; a full day
 * says so and offers the next free hour as a button. The iPad confirms right
 * here in the side panel; the phone in a sheet.
 */
export function RoomHours({
  room,
  firstDay,
  now,
}: {
  room: LibraryRoom;
  firstDay: string;
  now: Date;
}) {
  const { t, language } = useTranslation();
  const wide = useWideViewport();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const lessons = useAppStore((s) => s.schedule.data);
  const mine = useAppStore((s) => s.customEvents);
  const blocks = useLibraryStore((s) => s.blocks[room.featureId]);
  const loading = useLibraryStore((s) => s.status === 'loading' || s.status === 'idle');
  const days = weekdaysFrom(firstDay);
  const [day, setDayState] = useState(firstDay);
  const [picked, setPicked] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const setDay = (d: string) => {
    setDayState(d);
    setPicked([]);
    setConfirming(false);
  };

  const cells = blocks ? hourStates(blocks, day, now, lessonHours(lessons, day)) : [];
  const free = cells.filter((c) => c.state === 'free').map((c) => c.hour);
  // A booked hour is no longer free; a pick that lost one starts over.
  const sel = picked.every((h) => free.includes(h)) ? picked : [];
  const left = Math.max(0, DAILY_CAP - bookedOn(mine, day));
  const span = rangeOf(sel);
  const bar = useRef<HTMLDivElement>(null);
  const spanKey = span ? `${span.from}-${span.to}` : '';
  useEffect(() => {
    if (spanKey) bar.current?.scrollIntoView?.({ block: 'nearest' });
  }, [spanKey, confirming]);
  const later =
    blocks && free.length === 0
      ? nextFree(
          blocks,
          days.filter((d) => d > day),
          now
        )
      : null;
  const book = () => {
    if (!span) return;
    if (wide) setConfirming(true);
    else pushSheet({ kind: 'libraryBook', featureId: room.featureId, day, ...span });
  };

  return (
    <div className="space-y-3" data-testid={`library-room-${room.featureId}`}>
      <DayChips
        days={days}
        day={day}
        now={now}
        hasFree={(d) =>
          !!blocks && hourStates(blocks, d, now, new Set()).some((c) => c.state === 'free')
        }
        onPick={setDay}
      />
      {blocks === undefined || (loading && !blocks) ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.loading')}
        </p>
      ) : blocks === null ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.offline')}
        </p>
      ) : (
        <>
          {free.length === 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/70">
              <span>{t('mobile.library.fullDay')}</span>
              {later && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setDay(later.day)}
                >
                  {t('mobile.library.nextFree', {
                    day: new Date(`${later.day}T12:00:00`).toLocaleDateString(
                      language === 'cz' ? 'cs' : 'en',
                      {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'numeric',
                      }
                    ),
                    time: hh(later.hour),
                  })}
                </button>
              )}
            </div>
          )}
          <HourGrid
            cells={cells}
            picked={sel}
            onTap={(h) => setPicked(toggleHour(sel, h, free, left))}
          />
          <Legend lessons={cells.some((c) => c.lesson)} />
        </>
      )}
      {confirming && span ? (
        <div ref={bar} className="scroll-mb-4 rounded-2xl bg-base-100 p-3 ring-1 ring-primary/50">
          <p className="mb-2 text-sm font-semibold text-base-content">
            {t('mobile.library.confirmTitle')}
          </p>
          <LibraryConfirm
            pick={{ featureId: room.featureId, day, ...span }}
            onClose={() => {
              setConfirming(false);
              setPicked([]);
            }}
          />
        </div>
      ) : span ? (
        // On a phone the picked hours often fill the half sheet, so the bar
        // that books them is scrolled into view as it appears, clear of the
        // floating nav (scroll-mb).
        <div
          ref={bar}
          className="flex scroll-mb-28 items-center gap-3 rounded-2xl bg-base-100 p-3 ring-1 ring-base-content/10"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-base-content">
              {hh(span.from)}–{hh(span.to)} · {t('mobile.library.hours', { n: sel.length })}
            </p>
            <p className="text-xs text-base-content/70">
              {t('mobile.library.leftToday', { n: left - sel.length, cap: DAILY_CAP })}
            </p>
          </div>
          <button type="button" className="btn btn-primary min-h-11 rounded-xl" onClick={book}>
            {t('mobile.library.confirm')}
          </button>
        </div>
      ) : (
        <p className="text-xs text-base-content/70">
          {left > 0
            ? t('mobile.library.hint', { cap: DAILY_CAP })
            : t('mobile.library.capReached', { cap: DAILY_CAP })}
        </p>
      )}
    </div>
  );
}

function Legend({ lessons }: { lessons: boolean }) {
  const { t } = useTranslation();
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-base-content/70">
      <span>{t('mobile.library.legendPast')}</span>
      <span>
        <span className="line-through">08:00</span> {t('mobile.library.legendTaken')}
      </span>
      {lessons && <span className="text-warning">{t('mobile.library.legendLesson')}</span>}
    </p>
  );
}
