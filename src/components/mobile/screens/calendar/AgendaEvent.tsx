import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { useTranslation } from '../../../../hooks/useTranslation';
import { localizedCourseName, localizedRoom } from '../../../../utils/localizedLesson';

export interface AgendaEventProps {
    lesson: BlockLesson;
    onOpen: () => void;
}

/**
 * Colour tokens match `CalendarEventCard`'s desktop scheme exactly (same
 * `exam-*`/`lecture-*`/`seminar-*` design tokens) — these card backgrounds are
 * fixed light tints that do NOT follow the active theme, so the foreground
 * uses the fixed `content-primary`/`content-secondary` tokens too, not
 * theme-reactive `base-content`.
 */
function eventStyles(lesson: BlockLesson) {
    if (lesson.isExam) {
        return { bg: 'bg-exam-bg/85', border: 'border-exam-border/30', rail: 'border-l-exam-border', text: 'text-exam-text' };
    }
    if (lesson.isSeminar === 'true') {
        return { bg: 'bg-seminar-bg/85', border: 'border-seminar-border/30', rail: 'border-l-seminar-border', text: 'text-seminar-text' };
    }
    return { bg: 'bg-lecture-bg/85', border: 'border-lecture-border/30', rail: 'border-l-lecture-border', text: 'text-lecture-text' };
}

export function AgendaEvent({ lesson, onOpen }: AgendaEventProps) {
    const { t, language } = useTranslation();
    const courseName = localizedCourseName(lesson, language);
    const room = localizedRoom(lesson, language);
    // Surname only ("Melicharová"), not the full titled name — that is what
    // lets room, time and teacher share one line at 390px without clipping.
    // The full name is one tap away in the event sheet.
    const teacher = lesson.teachers[0]?.shortName || lesson.teachers[0]?.fullName;
    const styles = eventStyles(lesson);

    return (
        <button
            type="button"
            onClick={onOpen}
            className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border border-l-4 px-3 py-2.5 text-left ${styles.bg} ${styles.border} ${styles.rail}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-md font-semibold leading-snug text-content-primary">{courseName}</span>
                {lesson.isExam && (
                    <span className={`flex-shrink-0 text-xs font-bold uppercase ${styles.text}`}>
                        {t('course.badge.exam')}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1 text-2sm leading-snug text-content-secondary">
                <MapPin size={13} className="flex-shrink-0" />
                <span className="truncate">
                    {room} · {lesson.startTime} – {lesson.endTime}
                    {teacher && ` · ${teacher}`}
                </span>
            </div>
        </button>
    );
}
