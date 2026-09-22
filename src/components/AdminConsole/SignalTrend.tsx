import { useTranslation } from '../../hooks/useTranslation';
import type { TrendPoint } from '../../utils/trendSeries';
import { trendMax } from '../../utils/trendSeries';

/** Bar height in px at the chart's full height. */
const BAR_PX = 88;

/** "2026-09-15" -> "15.9." */
function shortDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.`;
}

/**
 * The daily shape of one selected signal.
 *
 * ONE series, deliberately. Stacking the three feature signals the way a
 * product-analytics tool would is unreadable here: the map is counted in
 * hundreds of installs and a finished eduroam setup in tens, so the small
 * series would be a sub-pixel sliver — and a suppressed signal has no numbers
 * to stack at all. Picking one is what makes the axis mean something, and it
 * also means the chart needs no legend and no second colour.
 *
 * Not buttons, unlike `DailyActivityChart`: there is no per-day drill-down
 * behind these bars, and an interactive element that does nothing is worse for
 * a keyboard than an honest picture. It is one `role="img"` with a label that
 * states the numbers, so a screen reader gets the trend as a sentence.
 */
export function SignalTrend({
  series,
  label,
  unit,
}: {
  series: TrendPoint[];
  /** The signal's own name, shown under the chart. */
  label: string;
  /** What the numbers count — "installs" or "opens". */
  unit: string;
}) {
  const { t } = useTranslation();
  const max = trendMax(series);
  const total = series.reduce((sum, p) => sum + p.value, 0);
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <figure className="mt-2">
      <div
        role="img"
        aria-label={t('admin.stats.trendAria', {
          label,
          days: series.length,
          total,
          unit,
          max,
        })}
        className="flex h-[88px] items-end gap-px border-b border-base-content/10"
      >
        {series.map((p) => (
          <div
            key={p.day}
            className="flex-1"
            // A day with activity must never render as nothing: floor a
            // non-zero bar at 2px so a single open is still visible next to a
            // spike. A true zero stays zero — the baseline rule carries it.
            style={{ height: p.value > 0 ? Math.max(2, Math.round((p.value / max) * BAR_PX)) : 0 }}
          >
            <div
              className="h-full w-full rounded-t-[2px] bg-primary"
              title={`${shortDay(p.day)} — ${p.value} ${unit}`}
            />
          </div>
        ))}
      </div>
      {/* The range only. The signal's own name is already on the selected row
          directly above, and repeating it here was the same word twice in one
          eyeful; the span is the thing the chart cannot otherwise tell you.
          Screen readers still get the name — it is in the aria-label. */}
      {first && last && (
        <figcaption className="mt-1 text-xs tabular-nums opacity-70">
          {shortDay(first.day)} – {shortDay(last.day)}
        </figcaption>
      )}
    </figure>
  );
}
