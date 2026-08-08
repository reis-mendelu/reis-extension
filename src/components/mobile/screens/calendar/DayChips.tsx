import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

export interface DayChipsProps {
  selectedIso: string;
  onSelect: (iso: string) => void;
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
export function DayChips({ selectedIso, onSelect }: DayChipsProps) {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const monday = mondayOf(selectedIso);

  const days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });

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
      <div className="flex flex-1 gap-1.5">
        {days.map((date) => {
          const iso = toIso(date);
          const isSelected = iso === selectedIso;
          const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
          const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`flex-1 rounded-full py-2 text-center text-sm transition-colors ${
                isSelected
                  ? 'bg-primary font-semibold text-primary-content'
                  : 'font-medium text-base-content/70'
              }`}
            >
              {label} {date.getDate()}
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
