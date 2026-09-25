import { useMemo } from 'react';
import { useSchedule, useExams } from '../../hooks/data';
import { useAppStore } from '../../store/useAppStore';
import { getCzechHoliday } from '../../utils/holidays';
import { parseDate } from '../../utils/date';
import { getWeekForDate } from '../../api/teachingWeek';
import { isLessonHidden } from '../../utils/hiddenLessons';
import { customEventToLesson } from '../../utils/customEventLesson';
import type { BlockLesson, DateInfo } from '../../types/calendarTypes';

/** Used only when IS Mendelu doesn't publish a length for the term. */
const DEFAULT_EXAM_MINUTES = 90;

export function useCalendarData(initialDate: Date) {
  const { schedule: storedSchedule, isLoaded: isScheduleLoaded } = useSchedule();
  const teachingWeekData = useAppStore((state) => state.teachingWeekData);
  const handshakeDone = useAppStore((state) => state.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((state) => state.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((state) => state.syncStatus.isSyncing);

  const { exams: storedExams, isLoaded: isExamsLoaded } = useExams();
  const customEvents = useAppStore((state) => state.customEvents);
  const language = useAppStore((state) => state.language);

  const weekDates = useMemo((): DateInfo[] => {
    const startOfWeek = new Date(initialDate);
    const day = startOfWeek.getDay() || 7;
    if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const locale = language === 'en' ? 'en-US' : 'cs-CZ';

    const dates: DateInfo[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push({
        weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
        day: String(d.getDate()),
        month: String(d.getMonth() + 1),
        year: String(d.getFullYear()),
        full: d.toLocaleDateString(locale),
      });
    }
    return dates;
  }, [initialDate, language]);

  const weekDateStrings = useMemo(() => {
    return weekDates.map((d) => `${d.year}${d.month.padStart(2, '0')}${d.day.padStart(2, '0')}`);
  }, [weekDates]);

  const examLessons = useMemo((): BlockLesson[] => {
    if (!storedExams) return [];
    const allExams: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    storedExams.forEach((subject) => {
      subject.sections.forEach((section) => {
        if (section.status === 'registered' && section.registeredTerm) {
          allExams.push({
            id: section.id,
            subjectCode: subject.code,
            title: `${subject.name} - ${section.name}`,
            start: parseDate(section.registeredTerm.date, section.registeredTerm.time),
            location: section.registeredTerm.room || 'Unknown',
            durationMinutes: section.registeredTerm.durationMinutes,
            meta: {
              teacher: section.registeredTerm.teacher || 'Unknown',
              teacherId: section.registeredTerm.teacherId || '',
            },
          });
        }
      });
    });

    return allExams.map((exam) => {
      const dateObj = new Date(exam.start);
      const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
      const startTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      // "Délka trvání akce" from the term detail page, attached during sync
      // (services/sync/examDurations.ts). IS omits it on some terms and the
      // fetch can fail, so keep the historical 90-minute assumption as the
      // fallback rather than inventing a different one.
      const endObj = new Date(
        dateObj.getTime() + (exam.durationMinutes ?? DEFAULT_EXAM_MINUTES) * 60000
      );
      return {
        id: `exam-${exam.id}-${exam.start}`,
        date: dateStr,
        startTime,
        endTime: `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`,
        courseCode: exam.subjectCode,
        courseName: exam.title,
        room: exam.location,
        roomStructured: { name: exam.location, id: '' },
        teachers: [
          { fullName: exam.meta.teacher, shortName: exam.meta.teacher, id: exam.meta.teacherId },
        ],
        isExam: true,
        examEvent: exam,
        isConsultation: 'false',
        studyId: '',
        facultyCode: '',
        isDefaultCampus: 'true',
        courseId: '',
        campus: '',
        isSeminar: 'false',
        periodId: '',
      } as BlockLesson;
    });
  }, [storedExams]);

  const hiddenItems = useAppStore((state) => state.hiddenItems);

  const scheduleData = useMemo((): BlockLesson[] => {
    const lessons = (storedSchedule || [])
      .filter((l) => weekDateStrings.includes(l.date))
      .filter((l) => !isLessonHidden(l, hiddenItems));
    const weekExams = examLessons.filter((e) => weekDateStrings.includes(e.date));

    const mappedCustomEvents = customEvents
      .filter((e) => weekDateStrings.includes(e.date))
      .map(customEventToLesson);

    return [...lessons, ...weekExams, ...mappedCustomEvents];
  }, [storedSchedule, examLessons, customEvents, weekDateStrings, hiddenItems]);

  const lessonsByDay = useMemo(() => {
    const grouped: Record<number, BlockLesson[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    scheduleData.forEach((lesson) => {
      const year = parseInt(lesson.date.substring(0, 4));
      const month = parseInt(lesson.date.substring(4, 6)) - 1;
      const day = parseInt(lesson.date.substring(6, 8));
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      if (dayIndex >= 0 && dayIndex < 7) grouped[dayIndex].push(lesson);
    });
    return [grouped[0], grouped[1], grouped[2], grouped[3], grouped[4], grouped[5], grouped[6]];
  }, [scheduleData]);

  const holidaysByDay = useMemo(() => {
    return weekDates.map((d) =>
      getCzechHoliday(new Date(parseInt(d.year), parseInt(d.month) - 1, parseInt(d.day)), language)
    );
  }, [weekDates, language]);

  const todayIndex = useMemo(() => {
    const today = new Date();
    return weekDates.findIndex(
      (d) =>
        parseInt(d.day) === today.getDate() &&
        parseInt(d.month) === today.getMonth() + 1 &&
        parseInt(d.year) === today.getFullYear()
    );
  }, [weekDates]);

  const isOutsideTeachingPeriod = useMemo(() => {
    if (!teachingWeekData || !isScheduleLoaded) return false;
    return weekDates.every((d) => {
      const date = new Date(parseInt(d.year), parseInt(d.month) - 1, parseInt(d.day));
      return getWeekForDate(teachingWeekData, date) === null;
    });
  }, [teachingWeekData, weekDates, isScheduleLoaded]);

  /**
   * How many columns the desktop grid draws: Mon–Fri, widened to take in a
   * weekend day that actually holds something.
   *
   * MENDELU teaches combined-study (dálkové) cohorts on Saturdays. The grid was
   * a fixed five, so those lessons were grouped into `lessonsByDay[5]` and then
   * never rendered — a dálkař opened the week to a blank grid with the
   * "empty week" overlay painted across it. Mirrors the phone's `weekDays()`,
   * which had to solve the same thing for the day strip.
   *
   * Data-driven on purpose: no setting to find, and the ordinary Mon–Fri week
   * stays five even columns, because an empty weekend never widens the grid.
   *
   * The count is contiguous rather than per-day (a lone Sunday lesson shows
   * Saturday too) — the columns are laid out side by side, so skipping one
   * would leave a hole in the week rather than a narrower week.
   */
  const visibleDayCount = useMemo(() => {
    if (lessonsByDay[6].length > 0) return 7;
    if (lessonsByDay[5].length > 0) return 6;
    return 5;
  }, [lessonsByDay]);

  // Everything inside the visible columns, which is what the empty-week overlay
  // has to judge. A weekend item can no longer fool that check by being counted
  // but undrawn: whatever makes this non-empty has also widened the grid.
  const visibleScheduleData = useMemo(
    () => scheduleData.filter((l) => weekDateStrings.slice(0, visibleDayCount).includes(l.date)),
    [scheduleData, weekDateStrings, visibleDayCount]
  );

  return {
    weekDates,
    lessonsByDay,
    holidaysByDay,
    todayIndex,
    showSkeleton:
      (storedSchedule?.length ?? 0) === 0 &&
      (!isScheduleLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing),
    scheduleData,
    visibleDayCount,
    visibleScheduleData,
    isOutsideTeachingPeriod,
    isScheduleLoaded,
    isExamsLoaded,
  };
}
