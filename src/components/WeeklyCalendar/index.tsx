import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MousePointerClick } from 'lucide-react';
import { CalendarHint } from '../CalendarHint';
import { SubjectFileDrawer } from '../SubjectFileDrawer';
import { useAppStore } from '../../store/useAppStore';
import { HOURS } from './utils';
import { useCalendarData } from './useCalendarData';
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

export function WeeklyCalendar({ initialDate = new Date(), onPrevWeek, onNextWeek }: { initialDate?: Date; onPrevWeek?: () => void; onNextWeek?: () => void }) {
    const language = useAppStore((state) => state.language);
    const isLanguageLoading = useAppStore((state) => state.isLanguageLoading);
    const isSelectingTime = useAppStore((state) => state.isSelectingTime);
    const setIsSelectingTime = useAppStore((state) => state.setIsSelectingTime);
    const pendingTimeSelection = useAppStore((state) => state.pendingTimeSelection);
    const setPendingTimeSelection = useAppStore((state) => state.setPendingTimeSelection);
    const isMobile = useIsMobile();
    const { weekDates, lessonsByDay, holidaysByDay, todayIndex, showSkeleton: dataLoading, scheduleData, isOutsideTeachingPeriod } = useCalendarData(initialDate);
    const { t } = useTranslation();
    const [selected, setSelected] = useState<BlockLesson | null>(null);
    const { isSeen, markSeen } = useHintStatus('calendar_event_click');

    const [pendingCreate, setPendingCreate] = useState<{ date: string, startTime: string, endTime: string, anchor: { x: number; y: number } } | null>(null);
    const [editingCustomEvent, setEditingCustomEvent] = useState<{ event: CalendarCustomEvent; anchor: { x: number; y: number } } | null>(null);
    const addCalendarCustomEvent = useAppStore(state => state.addCalendarCustomEvent);
    const updateCalendarCustomEvent = useAppStore(state => state.updateCalendarCustomEvent);
    const removeCalendarCustomEvent = useAppStore(state => state.removeCalendarCustomEvent);

    // Show skeletons if either data is loading (initial) or language is still being determined
    const showSkeleton = dataLoading || isLanguageLoading;

    const targetEventPosition = useMemo(() => {
        if (showSkeleton || isSeen) return null;

        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        const columnWidth = 100 / 5;

        let targetLesson: BlockLesson | null = null;
        let targetDayIndex = -1;

        // 1. Check for ongoing lesson today
        if (todayIndex >= 0 && todayIndex < 5) {
            const todayLessons = lessonsByDay[todayIndex] || [];
            targetLesson = todayLessons.find(l => {
                const [startH, startM] = l.startTime.split(':').map(Number);
                const [endH, endM] = l.endTime.split(':').map(Number);
                const start = startH + startM / 60;
                const end = endH + endM / 60;
                return currentHour >= start && currentHour <= end;
            }) || null;

            if (targetLesson) targetDayIndex = todayIndex;

            // 2. If no ongoing, check for next lesson today
            if (!targetLesson) {
                targetLesson = todayLessons
                    .filter(l => {
                        const [h, m] = l.startTime.split(':').map(Number);
                        return (h + m / 60) > currentHour;
                    })
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] || null;
                if (targetLesson) targetDayIndex = todayIndex;
            }
        }

        // 3. If still no lesson (or today is weekend/past work hours), find first lesson of the next active day
        if (!targetLesson) {
            for (let i = 0; i < 5; i++) {
                // Adjust index to start from "tomorrow" if today is weekday
                const checkIndex = todayIndex >= 0 && todayIndex < 5 ? (todayIndex + 1 + i) % 5 : i;
                const dayLessons = lessonsByDay[checkIndex] || [];
                if (dayLessons.length > 0) {
                    targetLesson = [...dayLessons].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
                    targetDayIndex = checkIndex;
                    break;
                }
            }
        }

        if (targetLesson && targetDayIndex !== -1) {
            const [h, m] = targetLesson.startTime.split(':').map(Number);
            return { 
                top: ((h - 7) * 60 + m) / (TOTAL_HOURS * 60) * 100, 
                left: targetDayIndex * columnWidth, 
                width: columnWidth 
            };
        }

        return null;
    }, [lessonsByDay, todayIndex, showSkeleton, isSeen]);

    const handleEventClick = (lesson: BlockLesson, anchor: { x: number; y: number }) => {
        if (lesson.isCustom && lesson.customEventId) {
            const event = useAppStore.getState().customEvents.find((ce: CalendarCustomEvent) => ce.id === lesson.customEventId);
            if (event) setEditingCustomEvent({ event, anchor });
            return;
        }
        setSelected(lesson);
        if (!isSeen) markSeen();
    };

    if (isMobile) {
        return (
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
            />
        );
    }

    return (
        <div className="flex h-full overflow-hidden flex-col font-inter bg-base-100">
            {/* Study Jam Time Selection Hint Banner */}
            <AnimatePresence>
                {isSelectingTime && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
                    >
                        <div className="bg-base-200 border border-white/10 shadow-2xl rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success shrink-0">
                                <MousePointerClick className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <h4 className="font-bold text-white text-sm">Vyberte čas pro doučování</h4>
                                <p className="text-xs text-gray-400">
                                    {pendingTimeSelection
                                        ? `Vybráno: ${pendingTimeSelection.formattedTime}`
                                        : "Klikněte na volné místo v kalendáři"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setPendingTimeSelection(null);
                                        setIsSelectingTime(false);
                                    }}
                                    className="btn btn-sm btn-ghost text-gray-400 hover:text-white"
                                >
                                    Zrušit
                                </button>
                                {pendingTimeSelection && (
                                    <button
                                        onClick={() => {
                                            const event = new CustomEvent('studyjam-time-selected', { detail: pendingTimeSelection.formattedTime });
                                            window.dispatchEvent(event);
                                            setPendingTimeSelection(null);
                                        }}
                                        className="btn btn-sm btn-success border-none text-white font-medium px-4"
                                    >
                                        Potvrdit
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <WeeklyCalendarHeader weekDates={weekDates} todayIndex={todayIndex} holidaysByDay={holidaysByDay} />
            <div className="flex-1 overflow-hidden">
                <div className="flex h-full">
                        <div className="w-12 flex-shrink-0 border-r border-base-300 bg-base-200 relative">
                            {HOURS.map((hour, i) => (
                                <div key={hour} className="absolute left-0 right-0 text-xs text-base-content/80 text-right pr-1"
                                     style={{ top: `${(i / TOTAL_HOURS) * 100}%`, height: `${100 / TOTAL_HOURS}%` }}>
                                    {hour}
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 relative flex">
                            <CalendarHint show={!isSeen} eventPosition={targetEventPosition || undefined} onDismiss={markSeen} />
                            <WeeklyCalendarGrid />
                            <CurrentTimeIndicator todayIndex={todayIndex} />
                            {!showSkeleton && scheduleData.length === 0 && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><p className="text-base-content/40 text-sm font-medium">{t(isOutsideTeachingPeriod ? 'calendar.outsideSemester' : 'calendar.emptyWeek')}</p></div>}
                            {[0, 1, 2, 3, 4].map(i => {
                                const wd = weekDates[i];
                                const dayKey = wd ? `${wd.year}${wd.month.padStart(2, '0')}${wd.day.padStart(2, '0')}` : null;
                                const confirmed = pendingCreate && dayKey === pendingCreate.date
                                    ? { startTime: pendingCreate.startTime, endTime: pendingCreate.endTime }
                                    : undefined;
                                return (
                                    <WeeklyCalendarDay key={i} dayIndex={i} date={wd} lessons={lessonsByDay[i] || []}
                                                       holiday={holidaysByDay[i]} isToday={i === todayIndex}
                                                       showSkeleton={showSkeleton} onEventClick={handleEventClick}
                                                       language={language} confirmedGhost={confirmed}
                                                       onCreateEvent={(date, startTime, endTime, anchor) => setPendingCreate({ date, startTime, endTime, anchor })} />
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
