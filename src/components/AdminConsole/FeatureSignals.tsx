import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { buildTrendSeries } from '../../utils/trendSeries';
import { SignalTrend } from './SignalTrend';
import { EventReachTable } from './EventReachTable';
import type { FeatureSignalCount } from '../../api/featureStats';
import { SIGNAL_LABEL_KEY } from './featureSignalLabels';
import { signalShare } from '../../utils/signalShare';

/** The label each database key is shown under. An unknown key is not rendered:
 *  a future deployment's signal with no copy for it would read as a bug. */
const LABEL_KEY: Record<string, string> = SIGNAL_LABEL_KEY;
/** Fixed order, so a signal that dropped to zero still holds its place rather
 *  than vanishing and making the panel look like it lost a feature. */
const ORDER = Object.keys(LABEL_KEY);

/** The window the RPC is asked for; the trend is drawn over the same span. */
const WINDOW_DAYS = 30;

const ROW =
  'flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors';
/** The selected row carries a filled tone AND a left rule — on its own the
 *  tone is a 1.08:1 step in the light theme, which is a legible surface but a
 *  weak selection cue. The rule is what makes the choice unmistakable. */
const SELECTED = 'bg-base-300 border-l-2 border-primary';
const UNSELECTED = 'bg-base-200 border-l-2 border-transparent hover:bg-base-300';

/**
 * The feature counters, each row a selector for the trend drawn beneath it,
 * and the per-event table (`EventReachTable`) beneath them.
 *
 * Installs, never people — said in the note, not implied — and `< 5` is
 * rendered as the words, because that is what the RPC's -1 means. A suppressed
 * signal has no daily series either (the RPC withholds the shape along with
 * the total), so selecting it says so rather than drawing an empty chart.

 */
export function FeatureSignals() {
  const { t } = useTranslation();
  const stats = useAppStore((s) => s.adminFeatureStats);
  // The usage panel's own daily install count, from a different RPC: when that
  // read failed there is nothing to divide by, and the rows show counts alone.
  const usageDaily = useAppStore((s) => s.adminStats?.daily ?? null);
  // Local, like the console's own tab selection (AdminConsole's `pane`): this
  // is which chart you are looking at, not anything the app knows about you.
  const [signal, setSignal] = useState<string | null>(null);
  if (!stats) return null;

  const byKey = new Map(stats.byFeature.map((r) => [r.feature, r]));
  // ONLY -1 is suppression. A missing row means the RPC returned nothing for
  // this signal — zero, not withheld — and saying otherwise would claim a
  // privacy action that never happened.
  const suppressed = (row: FeatureSignalCount | undefined) => row?.installs === -1;
  const value = (row: FeatureSignalCount | undefined) => {
    if (!row) return '0';
    return row.installs === -1 ? t('admin.stats.under5') : String(row.installs);
  };

  // Default to the first signal that actually has a shape to draw, so the
  // chart is never empty on arrival and never opens on a withheld series.
  // "10 % of the day's installs opened Vývěska" (2026-11-07). Pooled over the
  // window (utils/signalShare). A suppressed signal has no daily rows, so it
  // gets no share — a 0 % would claim a number the floor withheld.
  const share = (key: string, row: FeatureSignalCount | undefined): string | null => {
    if (!usageDaily || suppressed(row)) return null;
    const ratio = signalShare(
      stats.daily.filter((d) => d.feature === key),
      usageDaily
    );
    if (ratio === null) return null;
    const pct = ratio > 0 && ratio < 0.01 ? '< 1' : String(Math.round(ratio * 100));
    return t('admin.stats.signalShare', { pct });
  };

  const activeSignal = signal ?? ORDER.find((k) => !suppressed(byKey.get(k))) ?? null;
  const now = new Date();

  const signalSeries = buildTrendSeries(
    stats.daily
      .filter((d) => d.feature === activeSignal)
      .map((d) => ({ day: d.day, value: d.installs })),
    WINDOW_DAYS,
    now
  );

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.signals')}</h4>
        <div className="flex flex-col gap-1">
          {ORDER.map((key) => {
            const row = byKey.get(key);
            const isActive = key === activeSignal;
            const rowShare = share(key, row);
            return (
              <div key={key}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSignal(key)}
                  className={`${ROW} ${isActive ? SELECTED : UNSELECTED}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm">{t(`admin.stats.${LABEL_KEY[key]}`)}</span>
                    {/* Under the label, not beside the count: two numbers side
                        by side overflow a 320px console. */}
                    {rowShare && (
                      <span
                        className="text-xs tabular-nums opacity-70"
                        title={t('admin.stats.signalShareHint')}
                      >
                        {rowShare}
                      </span>
                    )}
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold tabular-nums">
                    {value(row)} {t('admin.stats.signalInstalls')}
                  </span>
                </button>
                {/* Inline, under the row it describes, rather than below the
                    whole list: a chart parked under all three rows reads as
                    belonging to the block, and the only thing saying which
                    series it drew would have been a caption repeating the row
                    just above it. Opening it in place says the same thing with
                    no words at all. */}
                {isActive &&
                  (suppressed(row) ? (
                    <p className="px-3 py-2 text-xs opacity-70">{t('admin.stats.trendWithheld')}</p>
                  ) : (
                    <SignalTrend
                      series={signalSeries}
                      label={t(`admin.stats.${LABEL_KEY[key]}`)}
                      unit={t('admin.stats.signalInstalls')}
                    />
                  ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs opacity-70">{t('admin.stats.signalsNote')}</p>
      </section>

      <EventReachTable />
    </div>
  );
}
