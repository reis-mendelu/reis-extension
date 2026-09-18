import { useState, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { CalendarHint } from '../CalendarHint';
import { SubjectFileDrawer } from '../SubjectFileDrawer';
import { useAppStore } from '../../store/useAppStore';
import { HOURS } from './utils';
import { useCalendarData } from './useCalendarData';
import { findHintTarget } from './hintTarget';
import { WeeklyCalendarHeader } from './WeeklyCalendarHeader';
import { WeeklyCalendarGrid } from './WeeklyCalendarGrid';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { WeeklyCalendarDay } from './WeeklyCalendarDay';
import { DailyView } from './DailyView';
import { CustomEventModal } from '../CustomEventModal';
import { useHintStatus } from '../../hooks/ui/useHintStatus';
import { useIsMobile } from '../../hooks/ui/useIsMobile';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson, CalendarCustomEvent } from '../../types/calendarTypes';

const TOTAL_HOURS = 14;

export function WeeklyCalendar({
  initialDate = new Date(),
  onPrevWeek,
  onNextWeek,
}: {
  initialDate?: Date;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}) {
  const language = useAppStore((state) => state.language);
  const isLanguageLoading = useAppStore((state) => state.isLanguageLoading);
  const isMobile = useIsMobile();
  const {
    weekDates,
    lessonsByDay,
    holidaysByDay,
    todayIndex,
    showSkeleton: dataLoading,
    visibleDayCount,
    visibleScheduleData,
    isOutsideTeachingPeriod,
  } = useCalendarData(initialDate);
  const { t } = useTranslation();
  const [selected, setSelected] = useState<BlockLesson | null>(null);
  const { isSeen, markSeen } = useHintStatus('calendar_event_click');

  const [pendingCreate, setPendingCreate] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    anchor?: { x: number; y: number };
  } | null>(null);
  const [editingCustomEvent, setEditingCustomEvent] = useState<{
    event: CalendarCustomEvent;
    anchor?: { x: number; y: number };
  } | null>(null);
  const addCalendarCustomEvent = useAppStore((state) => state.addCalendarCustomEvent);
  const updateCalendarCustomEvent = useAppStore((state) => state.updateCalendarCustomEvent);
  const removeCalendarCustomEvent = useAppStore((state) => state.removeCalendarCustomEvent);

  // Show skeletons if either data is loading (initial) or language is still being determined
  const showSkeleton = dataLoading || isLanguageLoading;

  const targetEventPosition = useMemo(
    () =>
      showSkeleton || isSeen
        ? null
        : findHintTarget(lessonsByDay, todayIndex, visibleDayCount, new Date()),
    [lessonsByDay, todayIndex, visibleDayCount, showSkeleton, isSeen]
  );

  const handleEventClick = (lesson: BlockLesson, anchor?: { x: number; y: number }) => {
    if (lesson.isCustom && lesson.customEventId) {
      const event = useAppStore
        .getState()
        .customEvents.find((ce: CalendarCustomEvent) => ce.id === lesson.customEventId);
      if (event) setEditingCustomEvent({ event, anchor });
      return;
    }
    setSelected(lesson);
    if (!isSeen) markSeen();
  };

  if (isMobile) {
    return (
      <div className="flex h-full overflow-hidden flex-col font-inter bg-base-100">
        <DailyView
          weekDates={weekDates}
          lessonsByDay={lessonsByDay}
          holidaysByDay={holidaysByDay}
          todayIndex={todayIndex}
          showSkeleton={showSkeleton}
          language={language}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          isOutsideTeachingPeriod={isOutsideTeachingPeriod}
          onEventClick={handleEventClick}
          onCreateEvent={(date, startTime, endTime, anchor) =>
            setPendingCreate({ date, startTime, endTime, anchor })
          }
        />
        <SubjectFileDrawer
          lesson={selected}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
        {pendingCreate && (
          <CustomEventModal
            mode="create"
            initialDate={pendingCreate.date}
            initialStart={pendingCreate.startTime}
            initialEnd={pendingCreate.endTime}
            anchor={pendingCreate.anchor}
            onClose={() => setPendingCreate(null)}
            onSave={(data: Omit<CalendarCustomEvent, 'id'>) => {
              addCalendarCustomEvent({ id: crypto.randomUUID(), ...data });
              setPendingCreate(null);
            }}
          />
        )}
        {editingCustomEvent && (
          <CustomEventModal
            mode="edit"
            event={editingCustomEvent.event}
            anchor={editingCustomEvent.anchor}
            onClose={() => setEditingCustomEvent(null)}
            onSave={(data: Omit<CalendarCustomEvent, 'id'>) => {
              updateCalendarCustomEvent(editingCustomEvent.event.id, data);
              setEditingCustomEvent(null);
            }}
            onDelete={() => {
              removeCalendarCustomEvent(editingCustomEvent.event.id);
              setEditingCustomEvent(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden flex-col font-inter bg-base-100">
      {/* Study Jam Time Selection Hint Banner */}
      <AnimatePresence></AnimatePresence>

      <WeeklyCalendarHeader
        weekDates={weekDates}
        todayIndex={todayIndex}
        holidaysByDay={holidaysByDay}
        dayCount={visibleDayCount}
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          <div className="w-12 flex-shrink-0 border-r border-base-300 bg-base-200 relative">
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute left-0 right-0 text-xs text-base-content/80 text-right pr-1 leading-none"
                style={{
                  top: `${(i / TOTAL_HOURS) * 100}%`,
                  transform: i > 0 ? 'translateY(-50%)' : undefined,
                }}
              >
                {hour}
              </div>
            ))}
          </div>
          <div className="flex-1 relative flex">
            <CalendarHint
              show={!isSeen}
              eventPosition={targetEventPosition || undefined}
              onDismiss={markSeen}
            />
            <WeeklyCalendarGrid dayCount={visibleDayCount} />
            <CurrentTimeIndicator todayIndex={todayIndex} dayCount={visibleDayCount} />
            {!showSkeleton && visibleScheduleData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <p className="text-base-content/40 text-sm font-medium">
                  {t(isOutsideTeachingPeriod ? 'calendar.outsideSemester' : 'calendar.emptyWeek')}
                </p>
              </div>
            )}
            {Array.from({ length: visibleDayCount }, (_, i) => i).map((i) => {
              const wd = weekDates[i];
              const dayKey = wd
                ? `${wd.year}${wd.month.padStart(2, '0')}${wd.day.padStart(2, '0')}`
                : null;
              const confirmed =
                pendingCreate && dayKey === pendingCreate.date
                  ? { startTime: pendingCreate.startTime, endTime: pendingCreate.endTime }
                  : undefined;
              return (
                <WeeklyCalendarDay
                  key={i}
                  date={wd}
                  lessons={lessonsByDay[i] || []}
                  holiday={holidaysByDay[i]}
                  isToday={i === todayIndex}
                  showSkeleton={showSkeleton}
                  onEventClick={handleEventClick}
                  language={language}
                  confirmedGhost={confirmed}
                  onCreateEvent={(date, startTime, endTime, anchor) =>
                    setPendingCreate({ date, startTime, endTime, anchor })
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
      <SubjectFileDrawer lesson={selected} isOpen={!!selected} onClose={() => setSelected(null)} />

      {pendingCreate && (
        <CustomEventModal
          mode="create"
          initialDate={pendingCreate.date}
          initialStart={pendingCreate.startTime}
          initialEnd={pendingCreate.endTime}
          anchor={pendingCreate.anchor}
          onClose={() => setPendingCreate(null)}
          onSave={(data: Omit<CalendarCustomEvent, 'id'>) => {
            addCalendarCustomEvent({ id: crypto.randomUUID(), ...data });
            setPendingCreate(null);
          }}
        />
      )}

      {editingCustomEvent && (
        <CustomEventModal
          mode="edit"
          event={editingCustomEvent.event}
          anchor={editingCustomEvent.anchor}
          onClose={() => setEditingCustomEvent(null)}
          onSave={(data: Omit<CalendarCustomEvent, 'id'>) => {
            updateCalendarCustomEvent(editingCustomEvent.event.id, data);
            setEditingCustomEvent(null);
          }}
          onDelete={() => {
            removeCalendarCustomEvent(editingCustomEvent.event.id);
            setEditingCustomEvent(null);
          }}
        />
      )}
    </div>
  );
}

export default WeeklyCalendar;
