import { useTranslation } from '../../../../../hooks/useTranslation';

/** The hours of one day as buttons: a free hour opens the confirm sheet, a taken one is greyed. */
export function HourGrid({
  free,
  hours,
  onPick,
}: {
  free: number[];
  hours: number[];
  onPick: (hour: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('mobile.library.pickHour')} className="grid grid-cols-4 gap-2">
      {hours.map((h) => {
        const ok = free.includes(h);
        return (
          <button
            key={h}
            type="button"
            disabled={!ok}
            onClick={() => onPick(h)}
            className={`min-h-11 rounded-xl text-sm font-semibold tabular-nums ${
              ok
                ? 'bg-base-100 text-base-content ring-1 ring-base-300 active:bg-base-300'
                : 'bg-base-300/40 text-base-content/40 line-through'
            }`}
          >
            {String(h).padStart(2, '0')}:00
          </button>
        );
      })}
    </div>
  );
}
