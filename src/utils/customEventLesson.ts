import type { BlockLesson, CalendarCustomEvent } from '../types/calendarTypes';

/**
 * A calendar custom event, expressed as the lesson shape every calendar view
 * already knows how to lay out and sort.
 *
 * Extracted from `useCalendarData`, where it was inlined. It was inlined there
 * for as long as the desktop grid was the only view that merged custom events —
 * and that is exactly why the phone never showed them: `CalendarScreen` builds
 * its day from `schedule.data` alone, so a block written by `rsvpBlockSync` (or
 * typed in by the student) was persisted, reconciled, and invisible.
 *
 * Both trees import this directly. A second copy of a twenty-field mapping is
 * how the two calendars start disagreeing about what a custom event is.
 *
 * The empty strings are not padding: `BlockLesson` is the shape IS Mendelu's
 * schedule parses into, and the fields a custom event has no answer for
 * (`courseCode`, `teachers`, `periodId`) have to be present and falsy so that
 * every consumer's existing "is there one?" check reads them as absent.
 */
export function customEventToLesson(event: CalendarCustomEvent): BlockLesson {
  const room = event.room || '';
  return {
    id: event.id,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    courseName: event.title,
    // Both language variants carry the same string: a student's own title and a
    // society's event name are written once, in whatever language they chose,
    // so `localizedCourseName` must resolve to it in either mode rather than
    // falling through to an empty `*Cs` and rendering a nameless card.
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
