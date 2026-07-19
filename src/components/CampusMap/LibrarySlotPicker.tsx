import { useTranslation } from '@/hooks/useTranslation';
import { MiniCalendar } from './MiniCalendar';
import { toISO } from './calendar';

function dayISO(d: Date): string {
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

// Pick a day from the shared MiniCalendar (only bookable days are selectable),
// then optionally an exact hour. "Any time" (hour = null) is the default and
// shows each room's open windows; picking an hour switches the rooms to a
// precise free/busy answer for that slot. Hours stay a compact pill row.
export function LibrarySlotPicker({
  days,
  dayIdx,
  onDay,
  hours,
  hour,
  onHour,
  loc,
}: {
  days: Date[];
  dayIdx: number;
  onDay: (i: number) => void;
  hours: number[];
  hour: number | null;
  onHour: (h: number | null) => void;
  loc: string;
}) {
  const { t } = useTranslation();
  const pill = 'btn btn-xs shrink-0 rounded-full font-medium';

  const selected = days[Math.min(dayIdx, days.length - 1)]!;
  const indexByISO = new Map(days.map((d, i) => [dayISO(d), i]));

  return (
    <div className="space-y-1.5">
      <MiniCalendar
        value={dayISO(selected)}
        onChange={(iso) => {
          const i = indexByISO.get(iso);
          if (i !== undefined) onDay(i);
        }}
        isDisabled={(iso) => !indexByISO.has(iso)}
        minDate={dayISO(days[0]!)}
        maxDate={dayISO(days[days.length - 1]!)}
        placeholder={t('map.libraryPickDay')}
        t={t}
        locale={loc}
      />
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        <button
          type="button"
          aria-pressed={hour === null}
          className={`${pill} ${hour === null ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onHour(null)}
        >
          {t('map.libraryAnyTime')}
        </button>
        {hours.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={h === hour}
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
