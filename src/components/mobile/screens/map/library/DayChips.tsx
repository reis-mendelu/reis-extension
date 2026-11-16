import { useTranslation } from '../../../../../hooks/useTranslation';
import { isoDay } from '../../../../../mobile/library/libraryDay';

/**
 * Five weekdays, all on screen at 320 px, labelled the way the calendar's own
 * day chips are ("Út 17"). A public holiday stays in the row, quieter, and
 * picking it says the library is closed and why.
 */
export function DayChips({
  days,
  day,
  now,
  closed,
  onPick,
}: {
  days: string[];
  day: string;
  now: Date;
  closed: (day: string) => boolean;
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
          className={`min-h-10 rounded-full text-[13px] font-semibold ${
            d === day
              ? 'bg-primary text-primary-content'
              : closed(d)
                ? 'bg-base-100 text-base-content/50 ring-1 ring-base-content/10'
                : 'bg-base-100 ring-1 ring-base-content/10'
          }`}
        >
          {label(d)}
        </button>
      ))}
    </div>
  );
}
