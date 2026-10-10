import { getCzechHoliday } from '../../../../utils/holidays';

export interface DayChipProps {
  date: Date;
  locale: string;
  language: 'cz' | 'en';
  /**
   * The agenda's day, in full ink and `aria-pressed`. Undefined in the week
   * view, which has no selection to draw or announce.
   */
  isSelected: boolean | undefined;
  isToday: boolean;
  hasLessons: boolean;
  /** The lesson/holiday dot. Off in the week view, where the grid says it. */
  showDot: boolean;
  /** Absent in the week view, where a chip is a label, not a control. */
  onClick?: () => void;
}

/** One day of the strip — see DayChips for the row around it. */
export function DayChip({
  date,
  locale,
  language,
  isSelected,
  isToday,
  hasLessons,
  showDot,
  onClick,
}: DayChipProps) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  // Marked in the row, not only once the day is opened: a student
  // scanning the week should see the day off without tapping into it.
  const holiday = getCzechHoliday(date, language);
  const todayFilled = isToday && isSelected !== false;
  return (
    <button
      type="button"
      aria-current={isToday ? 'date' : undefined}
      aria-pressed={isSelected}
      title={holiday ?? undefined}
      onClick={onClick}
      // aria-disabled, not `disabled`: a swipe that starts on a chip must still
      // reach the strip's pointer handlers, and older WebKit (pre-Safari 17
      // WKWebView, bug 219188) drops pointer events on disabled controls —
      // which would kill the week swipe in Týden, where every chip is inert.
      aria-disabled={onClick ? undefined : true}
      tabIndex={onClick ? undefined : -1}
      // The selection is ink, not colour. It was a lime tonal pill, and on
      // Saturday 3 October the arrow left one on Friday 9 with today in
      // another week: "the 9th of October gets highlighted as the current
      // day even though it's not". Colour now belongs to the today mark
      // alone; the selected day — which the header names as well — is simply
      // the one chip at full strength.
      className={`flex-1 whitespace-nowrap rounded-full py-2 text-center text-sm transition-colors max-[359px]:text-[11px] ${
        isSelected ? 'font-semibold text-base-content' : 'font-medium text-base-content/70'
      }`}
    >
      {/* Today is marked apart from the selection, the way Google
          Calendar does it: a filled circle on the date and the weekday
          in the same ink, wherever the student has moved to. It is the
          strip's only coloured mark; the selection is weight and ink.
          Ink on the lime fill, not white: white on #79be15 is 2.29:1,
          `primary-content` on it is 6.42:1 in both themes.
          Every number gets the circle's height, so the row keeps its
          height whichever chip carries it; only the circle is widened,
          or every "Čt 1" spreads apart.
          The circle fills only while today is the agenda's day. Filled
          whatever was selected, today looked the same before and after a tap
          on it — "when I go back to Friday, it doesn't change. How do I know
          if I'm on Friday?" With another day picked it is a ring in the same
          ink: still today, plainly not where you are. The week view selects
          nothing (`isSelected` undefined) and keeps the fill. A ring is a
          box-shadow, so the circle keeps its size and the row its height;
          `--tone-primary`, not `primary`, because lime on the light theme is
          under 3:1 for a mark. */}
      <span
        className={
          isToday
            ? `text-[var(--tone-primary)] ${todayFilled ? 'font-bold' : 'font-semibold'}`
            : undefined
        }
      >
        {label}
      </span>{' '}
      <span
        data-testid={isToday ? 'day-chip-today' : undefined}
        className={`inline-flex h-6 items-center justify-center rounded-full tabular-nums max-[359px]:h-5 ${
          !isToday
            ? ''
            : todayFilled
              ? 'min-w-6 bg-primary px-1 font-bold text-primary-content max-[359px]:min-w-5'
              : 'min-w-6 px-1 font-semibold text-[var(--tone-primary)] ring-[1.5px] ring-inset ring-[var(--tone-primary)] max-[359px]:min-w-5'
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
          agenda still names it either way.
          The week view keeps only the empty slot: the grid below shows the
          lessons and washes a holiday's column red, so the dots there said
          nothing — "the bullets below the days are useless in the weekly
          view" — and the slot keeps the strip one height in both views. */}
      {showDot && holiday ? (
        <span
          data-testid="day-chip-holiday"
          className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-error"
        />
      ) : showDot && hasLessons ? (
        <span
          data-testid="day-chip-lessons"
          className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-base-content/40"
        />
      ) : (
        // Keeps every chip the same height, so the row does not jitter
        // as the week changes.
        <span className="mx-auto mt-0.5 block h-1 w-1" />
      )}
    </button>
  );
}
