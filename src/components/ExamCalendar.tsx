import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ExamSubject } from './ExamDrawer';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    getWeek,
    isToday
} from 'date-fns';
import { cs } from 'date-fns/locale';

interface ExamCalendarProps {
    exams: ExamSubject[];
    onDateClick?: (date: Date) => void;
    highlightedDates?: Date[];
    viewDate?: Date | null;
    hoveredDate?: Date | null;
    fullDates?: Date[];
}

export function ExamCalendar({ exams, onDateClick, highlightedDates, viewDate, hoveredDate, fullDates }: ExamCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Sync view with external viewDate prop (e.g. from hover)
    useEffect(() => {
        if (viewDate) {
            setCurrentDate(viewDate);
        }
    }, [viewDate]);

    // Auto-navigate to the first highlighted date when they change
    useEffect(() => {
        if (highlightedDates && highlightedDates.length > 0) {
            setCurrentDate(highlightedDates[0]);
        }
    }, [highlightedDates]);

    // Extract registered exam dates
    const examDates = useMemo(() => {
        const dates: Date[] = [];
        exams.forEach(subject => {
            subject.sections.forEach(section => {
                if (section.status === 'registered' && section.registeredTerm?.date) {
                    const [day, month, year] = section.registeredTerm.date.split('.').map(Number);
                    dates.push(new Date(year, month - 1, day));
                }
            });
        });
        return dates;
    }, [exams]);

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentDate]);

    const weeks = useMemo(() => {
        const weeksArray = [];
        for (let i = 0; i < days.length; i += 7) {
            weeksArray.push(days.slice(i, i + 7));
        }
        return weeksArray;
    }, [days]);

    const weekNumbers = useMemo(() => {
        return weeks.map(week => getWeek(week[0], { weekStartsOn: 1 }));
    }, [weeks]);

    const daysOfWeek = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    return (
        <div className="inline-flex bg-base-100 rounded-lg shadow-lg overflow-hidden font-sans select-none">
            {/* Week Numbers Sidebar */}
            <div className="flex flex-col bg-base-200 border-r border-base-300">
                {/* Empty space for header alignment */}
                <div className="h-14"></div>
                {/* Empty space for days of week row */}
                <div className="h-6 mb-1"></div>
                {/* Week numbers aligned with calendar rows */}
                <div className="flex flex-col gap-0">
                    {weekNumbers.map((weekNum, index) => (
                        <div
                            key={index}
                            className="w-8 h-8 flex items-center justify-center text-[10px] text-base-content/60 font-medium"
                        >
                            {weekNum}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Calendar Area */}
            <div className="flex flex-col bg-base-100 p-4">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3 pl-1">
                    <h2 className="text-base font-normal text-base-content capitalize">
                        {format(currentDate, 'LLLL yyyy', { locale: cs })}
                    </h2>
                    <div className="flex gap-0">
                        <button
                            onClick={prevMonth}
                            className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-full transition-colors text-base-content/70"
                            aria-label="Previous month"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-full transition-colors text-base-content/70"
                            aria-label="Next month"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Days of Week Row */}
                <div className="grid grid-cols-7 gap-0 mb-1">
                    {daysOfWeek.map((day, index) => (
                        <div
                            key={index}
                            className="w-8 h-6 flex items-center justify-center text-[11px] font-medium text-base-content/60 uppercase"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Date Grid */}
                <div className="flex flex-col gap-0">
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="grid grid-cols-7 gap-0">
                            {week.map((day) => {
                                const isExamDay = examDates.some(examDate => isSameDay(examDate, day));
                                const isHighlightedDate = highlightedDates?.some(d => isSameDay(d, day));
                                const isFullDate = fullDates?.some(d => isSameDay(d, day));
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isTodayDate = isToday(day);
                                const isHovered = hoveredDate && isSameDay(day, hoveredDate);

                                return (
                                    <div
                                        key={day.toString()}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => !isFullDate && onDateClick?.(day)}
                                        className={`w-8 h-8 flex items-center justify-center relative group ${isFullDate ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <div className={`
                                            w-5 h-5 flex items-center justify-center rounded-full transition-all
                                            ${isCurrentMonth ? 'text-base-content' : 'text-base-content/40'}
                                            ${isTodayDate
                                                ? 'bg-info text-info-content font-bold hover:bg-info'
                                                : isHighlightedDate
                                                    ? 'bg-primary text-primary-content font-bold hover:bg-primary'
                                                    : isFullDate
                                                        ? 'bg-base-200 text-base-content/40 font-medium'
                                                        : 'group-hover:bg-base-200'
                                            }
                                            ${(isExamDay || isHighlightedDate) && !isTodayDate ? 'font-bold' : ''}
                                            text-xs font-medium
                                            ${isHovered ? 'ring-2 ring-primary z-10' : ''}
                                            ${isHighlightedDate && !isHovered ? 'group-hover:ring-2 group-hover:ring-primary' : ''}
                                        `}>
                                            {format(day, 'd')}
                                        </div>
                                        {isExamDay && !isTodayDate && (
                                            <div className="absolute bottom-0.5 w-4 h-0.5 bg-error rounded-sm"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

