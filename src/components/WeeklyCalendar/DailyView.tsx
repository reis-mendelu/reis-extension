import { useMemo, useEffect, useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSwipe } from '../../hooks/useSwipe';
import { CalendarEventCard } from '../CalendarEventCard';
import type { BlockLesson, DateInfo } from '../../types/calendarTypes';

interface DailyViewProps {
  weekDates: DateInfo[];
  lessonsByDay: BlockLesson[][];
  holidaysByDay: (string | null)[];
  todayIndex: number;
  showSkeleton: boolean;
  language: string;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  isOutsideTeachingPeriod: boolean;
  onEventClick: (lesson: BlockLesson, anchor: { x: number; y: number }) => void;
  onCreateEvent?: (date: string, startTime: string, endTime: string, anchor: { x: number; y: number }) => void;
}

export function DailyView({
  weekDates,
  lessonsByDay,
  holidaysByDay,
  todayIndex,
  showSkeleton,
  language,
  onPrevWeek,
  onNextWeek,
  isOutsideTeachingPeriod,
  onEventClick
}: DailyViewProps) {
  const { t } = useTranslation();
  const swipeRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Swipe to change weeks
  useSwipe(swipeRef, {
    onLeft: () => onNextWeek?.(),
    onRight: () => onPrevWeek?.(),
  });

  const [, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Automatically scroll to today's block when viewed week changes
  useEffect(() => {
    if (todayIndex >= 0) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`day-block-${todayIndex}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [weekDates, todayIndex]);

  // Format week range title (e.g. "12. 5. – 18. 5. 2026")
  const weekRangeTitle = useMemo(() => {
    if (!weekDates || weekDates.length === 0) return '';
    const start = weekDates[0];
    const end = weekDates[6] || weekDates[weekDates.length - 1];
    if (!start || !end) return '';

    if (start.year !== end.year) {
      return `${start.day}. ${start.month}. ${start.year} – ${end.day}. ${end.month}. ${end.year}`;
    }
    if (start.month !== end.month) {
      return `${start.day}. ${start.month}. – ${end.day}. ${end.month}. ${end.year}`;
    }
    return `${start.day}. – ${end.day}. ${start.month}. ${start.year}`;
  }, [weekDates]);

  // Check if the entire week is empty
  const isWeekEmpty = useMemo(() => {
    return lessonsByDay.every(dayLessons => !dayLessons || dayLessons.length === 0);
  }, [lessonsByDay]);

  // Skeleton loading view
  if (showSkeleton) {
    return (
      <div className="flex h-full flex-col font-inter bg-base-100 p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 p-4 border border-base-200 rounded-2xl bg-base-200/50 animate-pulse">
            <div className="h-4 w-1/4 bg-base-300 rounded" />
            <div className="h-6 w-3/4 bg-base-300 rounded" />
            <div className="h-4 w-1/2 bg-base-300 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={swipeRef} className="flex h-full overflow-hidden flex-col font-inter bg-base-100 relative">
      {/* Top Navigation Bar (Chevrons removed as requested; week swiping is default) */}
      <div className="flex items-center justify-center py-3 border-b border-base-300 bg-base-100 flex-shrink-0">
        <span className="text-sm font-bold text-base-content font-inter tracking-wide">
          {weekRangeTitle}
        </span>
      </div>

      {/* Agenda list scroll area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-6">
        {isWeekEmpty ? (
          <div className="flex flex-col items-center justify-center text-center p-8 mt-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Calendar size={28} />
            </div>
            <div className="max-w-xs space-y-1">
              <h3 className="font-bold text-base text-base-content">
                {language === 'en' ? 'Nothing Scheduled' : 'Nic se neděje'}
              </h3>
              <p className="text-xs text-base-content/50 leading-relaxed">
                {t(isOutsideTeachingPeriod ? 'calendar.outsideSemester' : 'calendar.emptyWeek')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
              const dateInfo = weekDates[dayIndex];
              if (!dateInfo) return null;

              const dayLessons = lessonsByDay[dayIndex] || [];
              const holiday = holidaysByDay[dayIndex];
              const isToday = dayIndex === todayIndex;

              // Hide empty days unless it's a holiday or it's today
              if (dayLessons.length === 0 && !holiday && !isToday) {
                return null;
              }

              // Sort lessons chronologically by start time
              const sortedLessons = [...dayLessons].sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              );

              const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              const localizedDayName = t(`days.${dayNames[dayIndex]}`);

              return (
                <div key={dayIndex} id={`day-block-${dayIndex}`} className="flex flex-col">
                  {/* Sticky Day Header */}
                  <div className="bg-base-200/90 backdrop-blur-md sticky top-0 py-2.5 px-4 z-10 border-b border-base-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-base-content">
                        {localizedDayName}, {parseInt(dateInfo.day)}. {parseInt(dateInfo.month)}.
                      </span>
                      {isToday && (
                        <span className="badge badge-primary badge-sm font-bold text-[10px] text-white py-1 px-1.5 uppercase tracking-wide">
                          {language === 'en' ? 'Today' : 'Dnes'}
                        </span>
                      )}
                    </div>
                    {holiday && (
                      <span className="text-[11px] font-semibold text-error bg-error/10 px-2 py-0.5 rounded-full max-w-[150px] truncate" title={holiday}>
                        {holiday}
                      </span>
                    )}
                  </div>

                  {/* Day Content */}
                  <div className="p-3 space-y-3">
                    {sortedLessons.length === 0 ? (
                      <div className="py-4 text-center border border-dashed border-base-300 rounded-xl bg-base-100/50">
                        <span className="text-xs text-base-content/40 font-medium">
                          {language === 'en' ? 'No events scheduled' : 'Žádné události'}
                        </span>
                      </div>
                    ) : (
                      sortedLessons.map((lesson) => {
                        return (
                          <div key={lesson.id} className="h-20 min-h-[5rem] relative">
                            <CalendarEventCard
                              lesson={lesson as any}
                              onClick={(e) => onEventClick(lesson, { x: e.clientX, y: e.clientY })}
                              language={language}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyView;
