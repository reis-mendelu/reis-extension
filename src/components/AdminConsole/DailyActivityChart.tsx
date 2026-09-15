import { useTranslation } from '../../hooks/useTranslation';
import type { DailyUsage } from '../../api/usageStats';

const BAR_PX = 120;

/** "2026-09-15" -> "15.9." — the axis label, short enough for 30 of them. */
function shortDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.`;
}

/**
 * Daily active devices, each bar split into new (top) and returning (bottom).
 *
 * The two segments sum to `active` by construction — see the RPC — so the bar
 * is checkable by eye. Buttons rather than SVG rects: picking a day has to be
 * reachable by keyboard, and a rect is not.
 */
export function DailyActivityChart({
  daily,
  selectedDay,
  onPick,
}: {
  daily: DailyUsage[];
  selectedDay: string | null;
  onPick: (day: string) => void;
}) {
  const { t } = useTranslation();
  if (daily.length === 0) return <p className="text-sm opacity-70">{t('admin.stats.noData')}</p>;

  const max = Math.max(1, ...daily.map((d) => d.active));
  const current = selectedDay ?? daily[daily.length - 1]?.day ?? null;

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="bg-primary inline-block size-2 rounded-xs" aria-hidden />
          {t('admin.stats.new')}
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-accent inline-block size-2 rounded-xs" aria-hidden />
          {t('admin.stats.returning')}
        </span>
      </div>
      <ul className="flex h-32 items-end gap-1" role="list">
        {daily.map((d) => {
          // A day with activity must never render as nothing: floor each
          // non-zero segment at 2px so a 3-device day is still clickable.
          const px = (n: number) => (n > 0 ? Math.max(2, Math.round((n / max) * BAR_PX)) : 0);
          return (
            <li key={d.day} className="flex h-full flex-1 flex-col justify-end">
              <button
                type="button"
                aria-pressed={d.day === current}
                aria-label={`${shortDay(d.day)} — ${d.active} ${t('admin.stats.activeDevices')}, ${d.newDevices} ${t('admin.stats.new')}, ${d.returningDevices} ${t('admin.stats.returning')}`}
                onClick={() => onPick(d.day)}
                className={`flex h-full cursor-pointer flex-col justify-end rounded-t-sm ${
                  d.day === current ? 'ring-base-content ring-2 ring-offset-1' : ''
                }`}
              >
                <span
                  className="bg-primary block w-full rounded-t-sm"
                  style={{ height: `${px(d.newDevices)}px` }}
                />
                <span
                  className="bg-accent block w-full"
                  style={{ height: `${px(d.returningDevices)}px` }}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="mt-1 flex gap-1" aria-hidden>
        {daily.map((d) => (
          <li key={d.day} className="flex-1 truncate text-center text-[0.625rem] opacity-60">
            {shortDay(d.day)}
          </li>
        ))}
      </ul>
    </div>
  );
}
