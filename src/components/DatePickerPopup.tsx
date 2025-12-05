import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    isToday
} from 'date-fns';
import { cs } from 'date-fns/locale';
import type { ExamTerm, ExamSubject } from './ExamDrawer';

interface DatePickerPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (termId: string) => void;
    terms: ExamTerm[];
    anchorRef: React.RefObject<HTMLElement | null>;
    allExams?: ExamSubject[];
}

export function DatePickerPopup({
    isOpen,
    onClose,
    onConfirm,
    terms,
    anchorRef,
    allExams = []
}: DatePickerPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Calculate position - always below anchor
    useEffect(() => {
        if (isOpen && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const popupWidth = 260;
            const padding = 12;

            let left = rect.left;
            const top = rect.bottom + 4; // Always below

            // Check right boundary
            if (left + popupWidth > window.innerWidth - padding) {
                left = rect.right - popupWidth;
            }
            if (left < padding) {
                left = padding;
            }

            setPosition({ top, left });
        }
    }, [isOpen, anchorRef]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(null);
            setSelectedTermId(null);
            if (terms.length > 0) {
                const [day, month, year] = terms[0].date.split('.').map(Number);
                setCurrentDate(new Date(year, month - 1, day));
            }
        }
    }, [isOpen, terms]);

    // Handle click outside - uses ref check
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        // Only close if clicking the backdrop itself
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Available dates from terms
    const availableDates = useMemo(() => {
        const dates: { date: Date; dateStr: string; isFull: boolean }[] = [];
        const seen = new Set<string>();

        terms.forEach(term => {
            if (!seen.has(term.date)) {
                seen.add(term.date);
                const [day, month, year] = term.date.split('.').map(Number);
                const termsOnDate = terms.filter(t => t.date === term.date);
                const allFull = termsOnDate.every(t => t.full);
                dates.push({
                    date: new Date(year, month - 1, day),
                    dateStr: term.date,
                    isFull: allFull
                });
            }
        });
        return dates;
    }, [terms]);

    // Other registered exams
    const otherRegisteredDates = useMemo(() => {
        const dates: { date: Date; label: string }[] = [];
        allExams.forEach(subject => {
            subject.sections.forEach(section => {
                if (section.status === 'registered' && section.registeredTerm?.date) {
                    const [day, month, year] = section.registeredTerm.date.split('.').map(Number);
                    dates.push({
                        date: new Date(year, month - 1, day),
                        label: `${subject.code} - ${section.name}`
                    });
                }
            });
        });
        return dates;
    }, [allExams]);

    // Terms for selected date
    const termsForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        return terms.filter(t => t.date === selectedDate);
    }, [selectedDate, terms]);

    // Calendar data
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

    const daysOfWeek = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

    if (!isOpen) return null;

    return (
        // Full-screen invisible backdrop that captures outside clicks
        <div
            className="fixed inset-0 z-[100]"
            onClick={handleBackdropClick}
        >
            {/* The popup */}
            <div
                ref={popupRef}
                className="absolute bg-slate-50 rounded-lg shadow-xl border border-slate-300 w-[260px]"
                style={{ top: position.top, left: position.left }}
                onClick={e => e.stopPropagation()}
            >
                {/* Calendar */}
                <div className="p-3">
                    {/* Month Header */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700 capitalize">
                            {format(currentDate, 'LLLL yyyy', { locale: cs })}
                        </span>
                        <div className="flex gap-0.5">
                            <button
                                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                                className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                                className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-0">
                        {daysOfWeek.map((day, i) => (
                            <div key={i} className="h-6 flex items-center justify-center text-[10px] font-medium text-slate-400 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Date Grid */}
                    <div className="flex flex-col">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-7">
                                {week.map((day) => {
                                    const dateInfo = availableDates.find(d => isSameDay(d.date, day));
                                    const hasAvailableExam = !!dateInfo && !dateInfo.isFull;
                                    const isFull = dateInfo?.isFull ?? false;
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const isTodayDate = isToday(day);
                                    const isSelected = dateInfo && selectedDate === dateInfo.dateStr;
                                    const otherExam = otherRegisteredDates.find(d => isSameDay(d.date, day));

                                    return (
                                        <div
                                            key={day.toString()}
                                            className="h-8 flex items-center justify-center relative"
                                        >
                                            {/* Small red dot */}
                                            {otherExam && (
                                                <div
                                                    className="absolute top-0 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500"
                                                    title={otherExam.label}
                                                />
                                            )}

                                            <button
                                                onClick={() => {
                                                    if (hasAvailableExam && dateInfo) {
                                                        setSelectedDate(dateInfo.dateStr);
                                                        setSelectedTermId(null);
                                                    }
                                                }}
                                                disabled={!hasAvailableExam}
                                                className={`
                                                    w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all
                                                    ${isSelected
                                                        ? 'bg-blue-500 text-white font-bold'
                                                        : hasAvailableExam
                                                            ? 'text-slate-900 font-bold hover:bg-blue-100 cursor-pointer'
                                                            : isFull
                                                                ? 'text-slate-300 cursor-default'
                                                                : isTodayDate
                                                                    ? 'ring-1 ring-blue-400 text-blue-600 font-medium cursor-default'
                                                                    : isCurrentMonth
                                                                        ? 'text-slate-400 cursor-default'
                                                                        : 'text-slate-200 cursor-default'
                                                    }
                                                `}
                                            >
                                                {format(day, 'd')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="font-bold text-slate-800">15</span> Volný
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Jiná
                        </span>
                    </div>
                </div>

                {/* Time Selector */}
                {selectedDate && (
                    <div className="px-3 pb-2 border-t border-slate-200 pt-2 bg-white">
                        <div className="text-[10px] font-medium text-slate-500 mb-1.5">Vyber čas:</div>
                        <div className="flex flex-wrap gap-1.5">
                            {termsForSelectedDate.map(term => (
                                <button
                                    key={term.id}
                                    onClick={() => setSelectedTermId(term.id)}
                                    disabled={term.full}
                                    className={`
                                        px-2 py-1 rounded text-xs font-medium transition-all
                                        ${term.full
                                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                            : selectedTermId === term.id
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                        }
                                    `}
                                >
                                    {term.time}
                                    {term.capacity && <span className="ml-0.5 opacity-60">({term.capacity})</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Confirm Button */}
                {selectedTermId && (
                    <div className="px-3 pb-3 bg-white">
                        <button
                            onClick={() => onConfirm(selectedTermId)}
                            className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition-colors"
                        >
                            Potvrdit
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
