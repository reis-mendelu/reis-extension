import { useTranslation } from '../../../../../hooks/useTranslation';
import type { HourCell } from '../../../../../mobile/library/libraryHours';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * One day's hours across the library. Gone hours are plain, taken ones crossed
 * out, picked ones filled; an hour with one of the student's classes says
 * "výuka" under it. No legend: each of those reads on its own.
 */
export function HourGrid({
  cells,
  picked,
  onTap,
}: {
  cells: HourCell[];
  picked: readonly number[];
  onTap: (hour: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('mobile.library.pickHour')}
      className="grid grid-cols-4 gap-1.5"
    >
      {cells.map(({ hour, state, lesson }) => {
        const on = picked.includes(hour);
        const look =
          state === 'past'
            ? 'text-base-content/40'
            : state === 'taken'
              ? 'bg-base-content/5 text-base-content/50 line-through'
              : on
                ? 'bg-primary text-primary-content'
                : lesson
                  ? 'bg-base-100 text-warning ring-1 ring-inset ring-warning'
                  : 'bg-base-100 text-base-content ring-1 ring-inset ring-base-content/20';
        return (
          <button
            key={hour}
            type="button"
            disabled={state !== 'free'}
            aria-pressed={state === 'free' ? on : undefined}
            onClick={() => onTap(hour)}
            className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-sm font-semibold tabular-nums ${look}`}
          >
            {hh(hour)}
            {lesson && state === 'free' && (
              <span className="text-[10px] font-semibold leading-none">
                {t('mobile.library.lessonTag')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
