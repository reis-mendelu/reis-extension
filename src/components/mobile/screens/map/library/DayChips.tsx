import { useTranslation } from '../../../../../hooks/useTranslation';
import { isoDay } from '../../../../../mobile/library/libraryDay';

/**
 * Five weekdays, all on screen at 320 px (no hidden scrolling row), labelled
 * the way the calendar's own day chips are ("Út 17"), with a dot under a day
 * that still has an hour free.
 */
export function DayChips({
  days,
  day,
  now,
  hasFree,
  onPick,
}: {
  days: string[];
  day: string;
  now: Date;
  hasFree: (day: string) => boolean;
  onPick: (day: string) => void;
}) {
  const { t, language } = useTranslation();
  const today = isoDay(now);
  const label = (d: string) => {
    if (d === today) return t('mobile.library.today');
    const date = new Date(`${d}T12:00:00`);
    const wd = date.toLocaleDateString(language === 'cz' ? 'cs' : 'en', { weekday: 'short' });
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1).replace('.', '')} ${date.getDate()}`;
  };
  return (
    <div role="group" className="grid grid-cols-5 gap-1.5">
      {days.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={d === day}
          onClick={() => onPick(d)}
          className={`relative min-h-10 rounded-full text-[13px] font-semibold ${
            d === day
              ? 'bg-primary text-primary-content'
              : 'bg-base-100 ring-1 ring-base-content/10'
          }`}
        >
          {label(d)}
          {hasFree(d) && (
            <span
              aria-hidden="true"
              className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${d === day ? 'bg-primary-content' : 'bg-success'}`}
            />
          )}
        </button>
      ))}
    </div>
  );
}
