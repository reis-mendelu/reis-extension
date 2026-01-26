import { useState, useEffect, useRef, useCallback } from 'react';
import { useDatePickerPosition } from '../hooks/useDatePickerPosition';
import { useDatePickerData } from '../hooks/useDatePickerData';
import { DatePickerCalendar } from './DatePicker/DatePickerCalendar';
import { DatePickerSelectors } from './DatePicker/DatePickerSelectors';
import type { ExamTerm, ExamSubject } from '../types/exams';

export function DatePickerPopup({ isOpen, onClose, onConfirm, terms, anchorRef, allExams = [] }: any) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
    const pos = useDatePickerPosition(isOpen, anchorRef);
    const data = useDatePickerData(terms, allExams, currentDate);

    useEffect(() => {
        if (isOpen) {
            setSelectedDate(null); setSelectedTermId(null);
            if (terms.length > 0) {
                const [d, m, y] = terms[0].date.split('.').map(Number);
                setCurrentDate(new Date(y, m - 1, d));
            }
        }
    }, [isOpen, terms]);

    useEffect(() => {
        if (!isOpen) return;
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100]" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="absolute bg-white rounded-xl shadow-popover-heavy border border-slate-200 w-[260px]" style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
                <DatePickerCalendar currentDate={currentDate} setCurrentDate={setCurrentDate} weeks={data.weeks} availableDates={data.availableDates} otherRegisteredDates={data.otherRegisteredDates} selectedDate={selectedDate} onSelectDate={(d: any) => { setSelectedDate(d); setSelectedTermId(null); }} />
                <DatePickerSelectors selectedDate={selectedDate} termsForDate={terms.filter((t: any) => t.date === selectedDate)} selectedTermId={selectedTermId} onSelectTerm={setSelectedTermId} onConfirm={onConfirm} />
            </div>
        </div>
    );
}
