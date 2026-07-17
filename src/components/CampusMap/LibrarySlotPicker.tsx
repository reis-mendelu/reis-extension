import { useTranslation } from '@/hooks/useTranslation';

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function dayLabel(d: Date, now: Date, loc: string, t: (k: string) => string): string {
  if (isSameDay(d, now)) return t('map.libraryDayToday');
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isSameDay(d, tomorrow)) return t('map.libraryDayTomorrow');
  return d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'numeric' });
}

// A two-row control: pick a day, then optionally an exact hour. "Any time"
// (hour = null) is the default and shows each room's open windows; picking an
// hour switches the rooms to a free/busy answer for that precise slot.
export function LibrarySlotPicker({
  days,
  dayIdx,
  onDay,
  hours,
  hour,
  onHour,
  now,
  loc,
}: {
  days: Date[];
  dayIdx: number;
  onDay: (i: number) => void;
  hours: number[];
  hour: number | null;
  onHour: (h: number | null) => void;
  now: Date;
  loc: string;
}) {
  const { t } = useTranslation();
  const pill = 'btn btn-xs shrink-0 rounded-full font-medium';

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {days.map((d, i) => (
          <button
            key={d.toDateString()}
            type="button"
            className={`${pill} ${i === dayIdx ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onDay(i)}
          >
            {dayLabel(d, now, loc, t)}
          </button>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        <button
          type="button"
          className={`${pill} ${hour === null ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onHour(null)}
        >
          {t('map.libraryAnyTime')}
        </button>
        {hours.map((h) => (
          <button
            key={h}
            type="button"
            className={`${pill} tabular-nums ${h === hour ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onHour(h)}
          >
            {h}:00
          </button>
        ))}
      </div>
    </div>
  );
}
