import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { getCzechHoliday } from '../../../../utils/holidays';

export interface DayChipsProps {
  selectedIso: string;
  onSelect: (iso: string) => void;
  /** Compact IS dates (YYYYMMDD) that have at least one lesson. */
  lessonDates: ReadonlySet<string>;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

function mondayOf(iso: string): Date {
  const date = fromIso(iso);
  const day = date.getDay();
  // Sunday is 0, so `1 - day` would jump FORWARD into the next week —
  // walk back six days instead.
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function shiftIso(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/**
 * Five weekday chips (Mon–Fri) plus the arrows that move a week at a time —
 * the phone's whole day/week switcher.
 *
 * The week is derived from the SELECTED day, not from a stored anchor. It used
 * to take `schedule.weekStart`, whose name promises "Monday of the fetched
 * week" but which `syncSchedule` writes as the semester start (Feb 1 / Sep 1):
 * on a device in April the row offered five days in February and there was no
 * way to reach the current week at all. Deriving it here means the row and the
 * screen header can never disagree.
 *
 * Moving a week needs no fetch: `syncSchedule` already stores the whole
 * semester in one go, so every week the arrows can reach is already local.
 */
export function DayChips({ selectedIso, onSelect, lessonDates }: DayChipsProps) {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const monday = mondayOf(selectedIso);

  // Mon–Fri is the row. A weekend day appears only when it actually holds a
  // lesson — MENDELU teaches combined-study cohorts on Saturdays and the
  // desktop grid carries all seven days, so a fixed five made those lessons
  // unreachable: the agenda follows the selected day and no chip could select a
  // Saturday. An empty weekend never pads the row, so the common week stays
  // five even-width chips.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  }).filter((date, i) => i < 5 || lessonDates.has(toIso(date).replace(/-/g, '')));

  const arrowClass =
    'flex h-9 w-7 flex-shrink-0 items-center justify-center rounded-full text-base-content/50';

  return (
    <div className="flex flex-shrink-0 items-center gap-1 px-2 pb-2.5 pt-4">
      <button
        type="button"
        onClick={() => onSelect(shiftIso(selectedIso, -7))}
        aria-label={t('mobile.calendar.prevWeek')}
        className={arrowClass}
      >
        <ChevronLeft size={18} />
      </button>
      {/* Below 360px a seven-chip week wrapped onto a second line — "Po 3" and
          "Ne 9" broke between the weekday and the date, doubling the row's
          height and leaving it ragged. The same `max-[359px]` tightening
          BottomNav and SubjectDrawerTabs already use keeps all seven on one
          line; wider phones are untouched. Measured at 320/390/430. */}
      <div className="flex flex-1 gap-1.5 max-[359px]:gap-0.5">
        {days.map((date) => {
          const iso = toIso(date);
          const isSelected = iso === selectedIso;
          const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
          const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
          // Marked in the row, not only once the day is opened: a student
          // scanning the week should see the day off without tapping into it.
          const holiday = getCzechHoliday(date, language === 'en' ? 'en' : 'cz');
          return (
            <button
              key={iso}
              type="button"
              title={holiday ?? undefined}
              onClick={() => onSelect(iso)}
              // Tonal, not a solid primary fill. `--color-primary` is a lime
              // #79be15 and `--color-primary-content` is white, which is
              // 2.29:1 — below AA, measured. The same tint BottomNav marks its
              // active tab with reads at full strength and is what the app's
              // soft-fill convention asks for anyway. Nothing rendered this
              // before: no chip could be selected while the row was anchored to
              // the semester start, so the failing state was never on screen.
              className={`flex-1 whitespace-nowrap rounded-full py-2 text-center text-sm transition-colors max-[359px]:text-[11px] ${
                isSelected
                  ? 'bg-primary/15 font-semibold text-primary'
                  : 'font-medium text-base-content/70'
              }`}
            >
              {label} {date.getDate()}
              {/* A dot rather than a colour on the label: the chip already
                  spends colour on selection, and a holiday can be selected. */}
              {holiday && (
                <span
                  data-testid="day-chip-holiday"
                  className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-error"
                />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect(shiftIso(selectedIso, 7))}
        aria-label={t('mobile.calendar.nextWeek')}
        className={arrowClass}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
