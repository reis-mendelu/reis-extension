import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileSheet } from '../../../store/types';
import type { BlockLesson } from '../../../types/calendarTypes';
import { localizedCourseName, localizedRoom } from '../../../utils/localizedLesson';

type EventDetailSheetData = Extract<MobileSheet, { kind: 'eventDetail' }>;

export interface EventDetailSheetProps {
  sheet: EventDetailSheetData;
  onClose: () => void;
}

/** Badge label key for the lesson's kind — mirrors `AgendaEvent`'s own check order. */
function kindLabelKey(lesson: BlockLesson): string {
  if (lesson.isExam) return 'course.badge.exam';
  if (lesson.isSeminar === 'true') return 'course.badge.seminar';
  return 'course.badge.lecture';
}

/**
 * Content-size sheet for a single agenda lesson: a kind/time/teacher header
 * plus two actions — jump to the room on the map, or hide just this
 * occurrence. Both reuse existing store plumbing rather than inventing a
 * second mechanism: `setMobileTab('map')` + `focusRoomByCode` (exactly what
 * `CalendarScreen`'s `openRoute` already does, including stripping the
 * trailing "(Campus)" suffix from the room string) and the hidden-items
 * slice's `hideEvent` (the same one `ProfileSheet`'s restore list reads
 * from).
 *
 * Renders nothing if the eventId no longer matches a lesson in `schedule`
 * (e.g. a stale sheet after a sync) rather than showing a broken sheet.
 */
export function EventDetailSheet({ sheet, onClose }: EventDetailSheetProps) {
  const { t, language } = useTranslation();
  const { schedule } = useSchedule();
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);

  // Matched on the day as well as the id. The store holds the WHOLE semester
  // and IS reuses a lesson id across the weeks it repeats —
  // `fetchDualLanguageSchedule` merges its two languages on
  // `id_date_startTime` precisely because the id alone does not identify an
  // occurrence. Matching by id only returned the first week's copy whatever day
  // was tapped, so the room could be wrong and `hideEvent` recorded the first
  // date, leaving the lesson the student wanted gone on screen.
  //
  // The day is optional — a sheet pushed before this carries none — so the
  // id-only lookup is kept for exactly that case and NO other. It must not be
  // an `||` fallback: when a day WAS supplied and no longer matches (a refresh
  // dropped the occurrence), falling through returns the first week's copy and
  // `onHide` records ITS date — re-entering, through the fallback, the very bug
  // the day was added to fix. A supplied day that matches nothing renders
  // nothing.
  const day = sheet.dayIso?.replace(/-/g, '');
  const lesson = day
    ? schedule.find((l) => l.id === sheet.eventId && l.date === day)
    : schedule.find((l) => l.id === sheet.eventId);
  if (!lesson) return null;

  const courseName = localizedCourseName(lesson, language);
  const room = localizedRoom(lesson, language);
  const teacher = lesson.teachers[0]?.fullName;
  const subtitle = `${room} · ${lesson.startTime}–${lesson.endTime}${teacher ? ` · ${teacher}` : ''}`;

  const onShowOnMap = () => {
    const roomCode = lesson.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
    setMobileTab('map');
    focusRoomByCode(roomCode);
  };

  /**
   * The subject behind the lesson — syllabus, files, difficulty, classmates.
   *
   * This slot used to hold "Skrýt tuto hodinu", which is the one thing almost
   * nobody wants from a lesson they just tapped. Pushed rather than replacing
   * the sheet, so closing the drawer comes back here.
   */
  const onShowSubject = () => {
    pushSheet({
      kind: 'subjectDrawer',
      courseCode: lesson.courseCode,
      courseName: lesson.courseName,
    });
  };

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        eyebrow={t(kindLabelKey(lesson))}
        title={courseName}
        subtitle={subtitle}
        onClose={onClose}
      />
      <div className="flex flex-col gap-2 px-4 pb-5">
        <button
          type="button"
          onClick={onShowOnMap}
          className="flex min-h-11 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-content"
        >
          {t('mobile.sheet.showOnMap')}
        </button>
        <button
          type="button"
          onClick={onShowSubject}
          className="flex min-h-11 items-center justify-center rounded-xl bg-primary/15 text-base font-semibold text-primary"
        >
          {t('mobile.sheet.showSubject')}
        </button>
      </div>
    </Sheet>
  );
}
