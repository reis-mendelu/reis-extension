import { useState, useRef, useMemo } from 'react';
import { CalendarEventCard } from '../CalendarEventCard';
import { organizeLessons, getEventStyle } from './utils';
import type { BlockLesson, DateInfo } from '../../types/calendarTypes';
import { useTranslation } from '../../hooks/useTranslation';

interface WeeklyCalendarDayProps {
  date?: DateInfo;
  lessons: BlockLesson[];
  holiday: string | null;
  isToday: boolean;
  showSkeleton: boolean;
  onEventClick: (lesson: BlockLesson, anchor: { x: number; y: number }) => void;
  language: string; // Current UI language
  onCreateEvent?: (
    date: string,
    startTime: string,
    endTime: string,
    anchor: { x: number; y: number }
  ) => void;
  confirmedGhost?: { startTime: string; endTime: string };
}

export function WeeklyCalendarDay({
  date,
  lessons,
  holiday,
  isToday,
  showSkeleton,
  onEventClick,
  language,
  onCreateEvent,
  confirmedGhost,
}: WeeklyCalendarDayProps) {
  const { t } = useTranslation();
  const { lessons: organizedLessons } = useMemo(() => organizeLessons(lessons), [lessons]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<{
    startMins: number;
    endMins: number;
    isDragging: boolean;
  } | null>(null);

  const getMinutesFromY = (clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const percentage = y / rect.height;
    const totalMinutes = 13 * 60; // 7:00 to 20:00
    const rawMinutes = percentage * totalMinutes;
    return Math.round(rawMinutes / 15) * 15;
  };

  const f = (m: number) =>
    `${String(7 + Math.floor(m / 60)).padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;

  const CUSTOM_EVENTS_ENABLED = false;
  const handleColumnPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!CUSTOM_EVENTS_ENABLED || holiday || showSkeleton || !date || e.target !== e.currentTarget)
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startMins = getMinutesFromY(e.clientY);
    setGhost({ startMins, endMins: Math.min(startMins + 60, 13 * 60), isDragging: true });
  };

  const handleColumnPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ghost?.isDragging) return;
    const newEnd = Math.max(ghost.startMins + 15, Math.min(getMinutesFromY(e.clientY), 13 * 60));
    setGhost((prev) => (prev ? { ...prev, endMins: newEnd } : null));
  };

  const handleColumnPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ghost?.isDragging || !date) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const yyyymmdd = `${date.year}${date.month.toString().padStart(2, '0')}${date.day.toString().padStart(2, '0')}`;
    onCreateEvent?.(yyyymmdd, f(ghost.startMins), f(ghost.endMins), { x: e.clientX, y: e.clientY });
    setGhost(null);
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative ${isToday ? 'bg-current-day' : ''} `}
      onPointerDown={handleColumnPointerDown}
      onPointerMove={handleColumnPointerMove}
      onPointerUp={handleColumnPointerUp}
    >
      {(ghost || confirmedGhost) &&
        (() => {
          const totalMins = 13 * 60;
          const toMins = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return (h - 7) * 60 + m;
          };
          const rs = ghost ? ghost.startMins : toMins(confirmedGhost!.startTime);
          const re = ghost ? ghost.endMins : toMins(confirmedGhost!.endTime);
          const isConfirmed = !ghost && !!confirmedGhost;
          return (
            <div
              className={`absolute left-1 right-1 z-30 rounded-md pointer-events-none shadow-sm border-2 border-dashed ${isConfirmed ? 'bg-primary/10 border-primary' : 'bg-secondary/15 border-secondary'}`}
              style={{
                top: `${(rs / totalMins) * 100}%`,
                height: `${((re - rs) / totalMins) * 100}%`,
              }}
            >
              <div
                className={`text-[10px] sm:text-xs font-bold p-1 bg-white/60 dark:bg-black/40 rounded-t-sm w-max backdrop-blur-md ${isConfirmed ? 'text-primary' : 'text-secondary'}`}
              >
                {`${f(rs)} – ${f(re)}`}
              </div>
            </div>
          );
        })()}

      {holiday && (
        <div className="absolute inset-0 flex items-center justify-center bg-error/10 z-20">
          <div className="flex flex-col items-center text-center p-4">
            <span className="text-3xl mb-2">🇨🇿</span>
            <h3 className="text-lg font-bold text-error">{holiday}</h3>
            <span className="text-sm text-error/80 font-medium uppercase tracking-wider mt-1">
              {t('calendar.publicHoliday')}
            </span>
          </div>
        </div>
      )}

      {!holiday && showSkeleton && (
        <>
          {[
            { top: '7%', height: '15%' },
            { top: '30%', height: '12%' },
            { top: '50%', height: '11%' },
          ].map((pos, i) => (
            <div
              key={i}
              className="absolute w-[94%] left-[3%] rounded-lg skeleton bg-base-300"
              style={pos}
            />
          ))}
        </>
      )}

      {!holiday &&
        !showSkeleton &&
        organizedLessons.map((lesson) => {
          const style = getEventStyle(lesson.startTime, lesson.endTime);
          const cols = lesson.maxColumns || 1;

          return (
            <div
              key={lesson.id}
              className="absolute"
              style={{
                ...style,
                left: `${(lesson.row / cols) * 100}%`,
                width: `${100 / cols}%`,
                pointerEvents: 'auto',
              }}
            >
              <CalendarEventCard
                lesson={lesson}
                onClick={(e) => {
                  onEventClick(lesson, { x: e.clientX, y: e.clientY });
                }}
                language={language}
              />
            </div>
          );
        })}
    </div>
  );
}
