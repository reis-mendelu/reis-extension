import { useMemo } from 'react';
import { useSchedule, useExams } from '../../hooks/data';
import { useAppStore } from '../../store/useAppStore';
import { getCzechHoliday } from '../../utils/holidays';
import { parseDate } from '../../utils/date';
import type { BlockLesson, DateInfo } from '../../types/calendarTypes';

export function useCalendarData(initialDate: Date) {
    const { schedule: storedSchedule, isLoaded: isScheduleLoaded } = useSchedule();
    const { exams: storedExams, isLoaded: isExamsLoaded } = useExams();
    const language = useAppStore((state) => state.language);

    const weekDates = useMemo((): DateInfo[] => {
        const startOfWeek = new Date(initialDate);
        const day = startOfWeek.getDay() || 7;
        if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const locale = language === 'en' ? 'en-US' : 'cs-CZ';

        const dates: DateInfo[] = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            dates.push({
                weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
                day: String(d.getDate()),
                month: String(d.getMonth() + 1),
                year: String(d.getFullYear()),
                full: d.toLocaleDateString(locale)
            });
        }
        return dates;
    }, [initialDate, language]);

    const weekDateStrings = useMemo(() => {
        return weekDates.map(d => `${d.year}${d.month.padStart(2, '0')}${d.day.padStart(2, '0')}`);
    }, [weekDates]);

    const examLessons = useMemo((): BlockLesson[] => {
        if (!storedExams) return [];
        const allExams: any[] = [];
        storedExams.forEach(subject => {
            subject.sections.forEach((section: any) => {
                if (section.status === 'registered' && section.registeredTerm) {
                    allExams.push({
                        id: section.id,
                        subjectCode: subject.code,
                        title: `${subject.name} - ${section.name}`,
                        start: parseDate(section.registeredTerm.date, section.registeredTerm.time),
                        location: section.registeredTerm.room || 'Unknown',
                        meta: { teacher: section.registeredTerm.teacher || 'Unknown', teacherId: section.registeredTerm.teacherId || '' }
                    });
                }
            });
        });

        return allExams.map(exam => {
            const dateObj = new Date(exam.start);
            const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
            const startTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
            const endObj = new Date(dateObj.getTime() + 90 * 60000);
            return {
                id: `exam-${exam.id}-${exam.start}`,
                date: dateStr,
                startTime,
                endTime: `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`,
                courseCode: exam.subjectCode,
                courseName: exam.title,
                room: exam.location,
                roomStructured: { name: exam.location, id: '' },
                teachers: [{ fullName: exam.meta.teacher, shortName: exam.meta.teacher, id: exam.meta.teacherId }],
                isExam: true,
                examEvent: exam,
                isConsultation: 'false', studyId: '', facultyCode: '', isDefaultCampus: 'true', courseId: '', campus: '', isSeminar: 'false', periodId: ''
            } as BlockLesson;
        });
    }, [storedExams]);

    const scheduleData = useMemo((): BlockLesson[] => {
        const lessons = (storedSchedule || []).filter(l => weekDateStrings.includes(l.date));
        const weekExams = examLessons.filter(e => weekDateStrings.includes(e.date));
        return [...lessons, ...weekExams];
    }, [storedSchedule, examLessons, weekDateStrings]);

    const lessonsByDay = useMemo(() => {
        const grouped: Record<number, BlockLesson[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
        scheduleData.forEach(lesson => {
            const year = parseInt(lesson.date.substring(0, 4));
            const month = parseInt(lesson.date.substring(4, 6)) - 1;
            const day = parseInt(lesson.date.substring(6, 8));
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            if (dayIndex >= 0 && dayIndex < 5) grouped[dayIndex].push(lesson);
        });
        return grouped;
    }, [scheduleData]);

    const holidaysByDay = useMemo(() => {
        return weekDates.map((d) => getCzechHoliday(new Date(parseInt(d.year), parseInt(d.month) - 1, parseInt(d.day)), language));
    }, [weekDates, language]);

    const todayIndex = useMemo(() => {
        const today = new Date();
        return weekDates.findIndex(d => parseInt(d.day) === today.getDate() && parseInt(d.month) === today.getMonth() + 1 && parseInt(d.year) === today.getFullYear());
    }, [weekDates]);

    return { weekDates, lessonsByDay, holidaysByDay, todayIndex, showSkeleton: scheduleData.length === 0 && (!isScheduleLoaded || !isExamsLoaded), scheduleData };
}
