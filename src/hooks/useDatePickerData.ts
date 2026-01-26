import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import type { ExamTerm, ExamSubject } from '../types/exams';

export function useDatePickerData(terms: ExamTerm[], allExams: ExamSubject[], currentDate: Date) {
    const availableDates = useMemo(() => {
        const dates: any[] = [];
        const seen = new Set<string>();
        terms.forEach(t => {
            if (!seen.has(t.date)) {
                seen.add(t.date);
                const [d, m, y] = t.date.split('.').map(Number);
                dates.push({ date: new Date(y, m - 1, d), dateStr: t.date, isFull: terms.filter(x => x.date === t.date).every(x => x.full) });
            }
        });
        return dates;
    }, [terms]);

    const otherRegisteredDates = useMemo(() => {
        const dates: any[] = [];
        allExams.forEach(s => s.sections.forEach(sec => {
            if (sec.status === 'registered' && sec.registeredTerm?.date) {
                const [d, m, y] = sec.registeredTerm.date.split('.').map(Number);
                dates.push({ date: new Date(y, m - 1, d), label: s.name });
            }
        }));
        return dates;
    }, [allExams]);

    const weeks = useMemo(() => {
        const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) });
        const ws = [];
        for (let i = 0; i < days.length; i += 7) ws.push(days.slice(i, i + 7));
        return ws;
    }, [currentDate]);

    return { availableDates, otherRegisteredDates, weeks };
}
