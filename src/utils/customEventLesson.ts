import type { BlockLesson, CalendarCustomEvent } from '../types/calendarTypes';

/**
 * A student's own calendar entry, in the shape every calendar surface reads.
 *
 * `CalendarCustomEvent` is what the store holds — a title, a day, two times and
 * maybe a room. `BlockLesson` is what the desktop grid and the phone agenda
 * both render. This is the one translation between them.
 *
 * Pure, and shared, for the reason `isLessonHidden` is: the desktop
 * (`useCalendarData`) and the phone (`CalendarScreen`) used to disagree about
 * custom events precisely because only one of them knew how to map one — the
 * "Mám zájem" block rendered in the week grid and was invisible on the phone,
 * which is the surface reIS is built for.
 *
 * `isCustom`/`customEventId` are the marks a consumer branches on: the row is
 * not a course, so it opens no subject drawer, and `courseCode` is empty by
 * construction rather than by accident.
 */
export function customEventToLesson(event: CalendarCustomEvent): BlockLesson {
  const room = event.room || '';
  return {
    id: event.id,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    courseName: event.title,
    courseNameCs: event.title,
    courseNameEn: event.title,
    courseCode: '',
    courseId: '',
    room,
    roomCs: room,
    roomEn: room,
    roomStructured: { name: room, id: '' },
    teachers: [],
    isExam: false,
    isCustom: true,
    customEventId: event.id,
    isConsultation: 'false',
    isSeminar: 'false',
    studyId: '',
    facultyCode: '',
    isDefaultCampus: 'true',
    campus: '',
    periodId: '',
  };
}
