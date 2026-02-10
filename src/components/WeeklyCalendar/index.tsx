import { useState, useMemo, useEffect } from 'react';
import { CalendarHint } from '../CalendarHint';
import { SubjectFileDrawer } from '../SubjectFileDrawer';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync/SyncService';
import { HOURS } from './utils';
import { useCalendarData } from './useCalendarData';
import { WeeklyCalendarHeader } from './WeeklyCalendarHeader';
import { WeeklyCalendarGrid } from './WeeklyCalendarGrid';
import { WeeklyCalendarDay } from './WeeklyCalendarDay';
import type { BlockLesson } from '../../types/calendarTypes';

const TOTAL_HOURS = 13;

export function WeeklyCalendar({ initialDate = new Date() }: { initialDate?: Date }) {
    const { weekDates, lessonsByDay, holidaysByDay, todayIndex, showSkeleton, scheduleData } = useCalendarData(initialDate);
    const [selected, setSelected] = useState<BlockLesson | null>(null);
    const [showCalendarHint, setShowCalendarHint] = useState(false);
    const [language, setLanguage] = useState<string>('cs');

    // Load initial language and subscribe to language changes
    useEffect(() => {
        IndexedDBService.get('meta', 'reis_language').then(lang => {
            if (lang) setLanguage(lang);
        });

        const unsubscribe = syncService.subscribe((action) => {
            if (action === 'LANGUAGE_UPDATE') {
                IndexedDBService.get('meta', 'reis_language').then(lang => {
                    if (lang) setLanguage(lang);
                });
            }
        });

        return () => { unsubscribe(); };
    }, []);

    const firstEventPosition = useMemo(() => {
        for (let i = 0; i < 5; i++) {
            const dayLessons = lessonsByDay[i] || [];
            if (dayLessons.length > 0) {
                const first = [...dayLessons].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
                const columnWidth = 100 / 5;
                const [h, m] = first.startTime.split(':').map(Number);
                return { top: ((h - 7) * 60 + m) / (13 * 60) * 100, left: i * columnWidth, width: columnWidth };
            }
        }
        return null;
    }, [lessonsByDay]);

    useEffect(() => {
        if (showSkeleton || scheduleData.length === 0) return;
        IndexedDBService.get('meta', 'calendar_click_hint_shown').then(seen => {
            if (!seen) {
                IndexedDBService.set('meta', 'calendar_click_hint_shown', true);
                setTimeout(() => setShowCalendarHint(true), 1000);
                setTimeout(() => setShowCalendarHint(false), 5000);
            }
        });
    }, [showSkeleton, scheduleData.length]);

    return (
        <div className="flex h-full overflow-hidden flex-col font-inter bg-base-100">
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
                        <CalendarHint show={showCalendarHint} firstEventPosition={firstEventPosition || undefined} />
                        <WeeklyCalendarGrid />
                        {[0, 1, 2, 3, 4].map(i => (
                            <WeeklyCalendarDay key={i} dayIndex={i} lessons={lessonsByDay[i] || []}
                                               holiday={holidaysByDay[i]} isToday={i === todayIndex}
                                               showSkeleton={showSkeleton} onEventClick={setSelected}
                                               language={language} />
                        ))}
                    </div>
                </div>
            </div>
            <SubjectFileDrawer lesson={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
        </div>
    );
}

export default WeeklyCalendar;
