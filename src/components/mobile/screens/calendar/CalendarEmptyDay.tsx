import { Calendar } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

export interface CalendarEmptyDayProps {
  /** The holiday's name when the selected day is one, otherwise null. */
  holiday: string | null;
}

/**
 * The selected day with nothing on it.
 *
 * Two different facts share this space: "you have nothing on" and "the
 * university is closed". Until `getCzechHoliday` was wired into the phone the
 * second one rendered as the first, so 28 September read as a lucky free
 * Monday.
 */
export function CalendarEmptyDay({ holiday }: CalendarEmptyDayProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full ${
          holiday ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
        }`}
      >
        <Calendar size={28} />
      </div>
      <div className="font-display text-lg font-bold">
        {holiday ? t('mobile.calendar.holiday') : t('mobile.calendar.emptyTitle')}
      </div>
      <div className="max-w-56 text-xs text-base-content/60">
        {holiday ?? t('mobile.calendar.emptyBody')}
      </div>
    </div>
  );
}
