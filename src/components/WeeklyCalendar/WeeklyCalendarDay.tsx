import { CalendarEventCard } from '../CalendarEventCard';
import { organizeLessons, getEventStyle } from './utils';
import type { BlockLesson } from '../../types/calendarTypes';

interface WeeklyCalendarDayProps {
    dayIndex: number;
    lessons: BlockLesson[];
    holiday: string | null;
    isToday: boolean;
    showSkeleton: boolean;
    onEventClick: (lesson: BlockLesson) => void;
    language: string; // Current UI language
}

export function WeeklyCalendarDay({ 
    lessons, holiday, isToday, showSkeleton, onEventClick, language 
}: WeeklyCalendarDayProps) {
    const { lessons: organizedLessons, totalRows } = organizeLessons(lessons);

    return (
        <div className={`flex-1 relative ${isToday ? 'bg-current-day' : ''}`}>
            {holiday && (
                <div className="absolute inset-0 flex items-center justify-center bg-error/10 z-20">
                    <div className="flex flex-col items-center text-center p-4">
                        <span className="text-3xl mb-2">🇨🇿</span>
                        <h3 className="text-lg font-bold text-error">{holiday}</h3>
                        <span className="text-sm text-error/80 font-medium uppercase tracking-wider mt-1">Státní svátek</span>
                    </div>
                </div>
            )}

            {!holiday && showSkeleton && (
                <>
                    {[
                        { top: '7%', height: '15%' }, { top: '30%', height: '12%' }, { top: '50%', height: '11%' }
                    ].map((pos, i) => (
                        <div key={i} className="absolute w-[94%] left-[3%] rounded-lg skeleton bg-base-300" style={pos} />
                    ))}
                </>
            )}

            {!holiday && !showSkeleton && organizedLessons.map((lesson) => {
                const style = getEventStyle(lesson.startTime, lesson.endTime);
                const hasOverlap = totalRows > 1;

                return (
                    <div
                        key={lesson.id}
                        className="absolute"
                        style={{
                            ...style,
                            left: hasOverlap ? `${(lesson.row / totalRows) * 100}%` : '0',
                            width: hasOverlap ? `${100 / totalRows}%` : '100%',
                        }}
                    >
                        <CalendarEventCard lesson={lesson} onClick={() => onEventClick(lesson)} language={language} />
                    </div>
                );
            })}
        </div>
    );
}
