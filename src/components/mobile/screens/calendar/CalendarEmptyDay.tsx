import { Calendar, CalendarOff } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

export interface CalendarEmptyDayProps {
  /** The holiday's name when the selected day is one, otherwise null. */
  holiday: string | null;
  /** The day falls outside the semester's teaching period. */
  outsideTeaching?: boolean;
  /** The first teaching day, when it is known and still ahead. */
  teachingStartsOn?: Date | null;
}

/**
 * The selected day with nothing on it.
 *
 * Three different facts share this space, and until now they all rendered as
 * the third:
 *
 *  - "the university is closed" — a state holiday,
 *  - "there is no schedule to see yet" — before term, or in a reading week,
 *  - "you happen to be free" — an ordinary empty day.
 *
 * "Nic nemáš, pohodička" over a day three weeks before term is the same kind of
 * lie as showing it mid-sync: cheerful, and about the wrong thing. The desktop
 * has distinguished the middle case since it shipped, from IS's own
 * teaching-week table, and reuses its string here.
 */
export function CalendarEmptyDay({
  holiday,
  outsideTeaching = false,
  teachingStartsOn = null,
}: CalendarEmptyDayProps) {
  const { t, language } = useTranslation();
  const teachingStarts = teachingStartsOn
    ? t('mobile.calendar.teachingStarts', {
        date: teachingStartsOn.toLocaleDateString(language === 'en' ? 'en-US' : 'cs-CZ', {
          day: 'numeric',
          month: 'numeric',
        }),
      })
    : null;

  // Holiday first: it is the more specific fact. A holiday inside the teaching
  // period is a closure; one outside it is both, and naming the closure is more
  // use than naming the gap.
  const title = holiday
    ? t('mobile.calendar.holiday')
    : outsideTeaching
      ? t('calendar.outsideSemester')
      : t('mobile.calendar.emptyTitle');

  // When teaching starts is the thing a student actually wants from "outside
  // the teaching period" — it turns a statement into an answer.
  const body = holiday
    ? holiday
    : outsideTeaching
      ? (teachingStarts ?? t('mobile.calendar.emptyBody'))
      : t('mobile.calendar.emptyBody');

  const muted = holiday || outsideTeaching;

  return (
    <div
      data-testid={outsideTeaching && !holiday ? 'calendar-outside-teaching' : undefined}
      className="flex flex-col items-center gap-3 px-6 py-14 text-center"
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full ${
          holiday ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
        }`}
      >
        {/* A crossed-out calendar for "there is no schedule here", the plain one
            for a day that simply has nothing on it. */}
        {muted && !holiday ? <CalendarOff size={28} /> : <Calendar size={28} />}
      </div>
      <div className="font-display text-lg font-bold">{title}</div>
      <div className="max-w-56 text-xs text-base-content/60">{body}</div>
    </div>
  );
}
