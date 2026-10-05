import { getCzechHoliday } from '../../../../utils/holidays';

export interface DayChipProps {
  date: Date;
  locale: string;
  language: 'cz' | 'en';
  /** Drawn as the tonal pill. False for every chip in the week view. */
  isSelected: boolean;
  isToday: boolean;
  hasLessons: boolean;
  onClick: () => void;
}

/** One day of the strip — see DayChips for the row around it. */
export function DayChip({
  date,
  locale,
  language,
  isSelected,
  isToday,
  hasLessons,
  onClick,
}: DayChipProps) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  // Marked in the row, not only once the day is opened: a student
  // scanning the week should see the day off without tapping into it.
  const holiday = getCzechHoliday(date, language);
  return (
    <button
      type="button"
      aria-current={isToday ? 'date' : undefined}
      title={holiday ?? undefined}
      onClick={onClick}
      // Tonal, not a solid primary fill. `--color-primary` is a lime
      // #79be15 and `--color-primary-content` is white, which is
      // 2.29:1 — below AA, measured. The same tint BottomNav marks its
      // active tab with reads at full strength and is what the app's
      // soft-fill convention asks for anyway. Nothing rendered this
      // before: no chip could be selected while the row was anchored to
      // the semester start, so the failing state was never on screen.
      className={`flex-1 whitespace-nowrap rounded-full py-2 text-center text-sm transition-colors max-[359px]:text-[11px] ${
        isSelected
          ? 'bg-primary/15 font-semibold text-[var(--tone-primary)]'
          : 'font-medium text-base-content/70'
      }`}
    >
      {/* Today is marked apart from the selection, the way Google
          Calendar does it: a filled circle on the date and the weekday
          in the same ink, wherever the student has moved to. In the day
          view the selection keeps its tonal pill, and on today the two
          stack; the week view draws no selection at all.
          Ink on the lime fill, not white: white on #79be15 is 2.29:1,
          `primary-content` on it is 6.42:1 in both themes.
          Every number gets the circle's height, so the row keeps its
          height whichever chip carries it; only the circle is widened,
          or every "Čt 1" spreads apart. */}
      <span className={isToday ? 'font-bold text-[var(--tone-primary)]' : undefined}>{label}</span>{' '}
      <span
        data-testid={isToday ? 'day-chip-today' : undefined}
        className={`inline-flex h-6 items-center justify-center rounded-full tabular-nums max-[359px]:h-5 ${
          isToday
            ? 'min-w-6 bg-primary px-1 font-bold text-primary-content max-[359px]:min-w-5'
            : ''
        }`}
      >
        {date.getDate()}
      </span>
      {/* One dot, three states: a holiday is red, a day with something
          on it is primary, and an empty day carries nothing — absence
          is the clearest way to say "nothing here", and it is the only
          one that costs no contrast.
          A holiday wins over lessons in the rare case of both: the
          closure is the more surprising fact, and the banner above the
          agenda still names it either way. */}
      {holiday ? (
        <span
          data-testid="day-chip-holiday"
          className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-error"
        />
      ) : hasLessons ? (
        <span
          data-testid="day-chip-lessons"
          className={`mx-auto mt-0.5 block h-1 w-1 rounded-full ${
            isSelected ? 'bg-primary' : 'bg-base-content/40'
          }`}
        />
      ) : (
        // Keeps every chip the same height, so the row does not jitter
        // as the week changes.
        <span className="mx-auto mt-0.5 block h-1 w-1" />
      )}
    </button>
  );
}
