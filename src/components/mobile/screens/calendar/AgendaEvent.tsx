import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { useTranslation } from '../../../../hooks/useTranslation';

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
    const courseName = (language === 'en' ? lesson.courseNameEn : lesson.courseNameCs) ?? lesson.courseName;
    const room = (language === 'en' ? lesson.roomEn : lesson.roomCs) ?? lesson.room;
    const teacher = lesson.teachers[0]?.fullName;
    const styles = eventStyles(lesson);

    return (
        <div
            onClick={onOpen}
            className={`flex cursor-pointer flex-col gap-1 rounded-xl border border-l-4 p-3 ${styles.bg} ${styles.border} ${styles.rail}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-content-primary">{courseName}</span>
                {lesson.isExam && (
                    <span className={`flex-shrink-0 text-2xs font-bold uppercase ${styles.text}`}>
                        {t('course.badge.exam')}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1 text-xs text-content-secondary">
                <MapPin size={12} className="flex-shrink-0" />
                <span className="truncate">
                    {room} · {lesson.startTime} – {lesson.endTime}
                    {teacher && ` · ${teacher}`}
                </span>
            </div>
        </div>
    );
}
