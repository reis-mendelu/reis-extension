import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { buildTrendSeries } from '../../utils/trendSeries';
import { SignalTrend } from './SignalTrend';
import type { FeatureSignalCount } from '../../api/featureStats';

/** The label each database key is shown under. An unknown key is not rendered:
 *  a future deployment's signal with no copy for it would read as a bug. */
const LABEL_KEY: Record<string, string> = {
  map_dwell_3s: 'signalMapDwell',
  eduroam_wifi_configured: 'signalEduroamConfigured',
  eduroam_profile_delivered: 'signalEduroamDelivered',
};
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
 * The three feature counters and the most-opened events on the map, each row a
 * selector for the trend drawn beneath it.
 *
 * Installs, never people — said in the note, not implied — and `< 5` is
 * rendered as the words, because that is what the RPC's -1 means. A suppressed
 * signal has no daily series either (the RPC withholds the shape along with
 * the total), so selecting it says so rather than drawing an empty chart.
 *
 * The event numbers are opens with no identifier behind them at all, which is a
 * different claim again, so they carry their own note rather than sharing one.
 */
export function FeatureSignals() {
  const { t } = useTranslation();
  const stats = useAppStore((s) => s.adminFeatureStats);
  // Local, like the console's own tab selection (AdminConsole's `pane`): this
  // is which chart you are looking at, not anything the app knows about you.
  const [signal, setSignal] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  if (!stats) return null;

  const byKey = new Map(stats.byFeature.map((r) => [r.feature, r]));
  const suppressed = (row: FeatureSignalCount | undefined) => !row || row.installs === -1;
  const value = (row: FeatureSignalCount | undefined) => {
    if (!row) return '0';
    return row.installs === -1 ? t('admin.stats.under5') : String(row.installs);
  };

  // Default to the first signal that actually has a shape to draw, so the
  // chart is never empty on arrival and never opens on a withheld series.
  const activeSignal = signal ?? ORDER.find((k) => !suppressed(byKey.get(k))) ?? null;
  const activeEvent = eventId ?? stats.topEvents[0]?.id ?? null;
  const now = new Date();

  const signalSeries = buildTrendSeries(
    stats.daily
      .filter((d) => d.feature === activeSignal)
      .map((d) => ({ day: d.day, value: d.installs })),
    WINDOW_DAYS,
    now
  );
  const eventSeries = buildTrendSeries(
    stats.eventDaily
      .filter((d) => d.eventId === activeEvent)
      .map((d) => ({ day: d.day, value: d.views })),
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
            return (
              <div key={key}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSignal(key)}
                  className={`${ROW} ${isActive ? SELECTED : UNSELECTED}`}
                >
                  <span className="min-w-0 text-sm">{t(`admin.stats.${LABEL_KEY[key]}`)}</span>
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

      <section>
        <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.topEvents')}</h4>
        {stats.topEvents.length === 0 ? (
          <p className="text-sm opacity-60">{t('admin.stats.noData')}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              {stats.topEvents.map((e) => {
                const isActive = e.id === activeEvent;
                return (
                  <div key={e.id}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setEventId(e.id)}
                      className={`${ROW} ${isActive ? SELECTED : UNSELECTED}`}
                    >
                      <span className="min-w-0 truncate text-sm">{e.title}</span>
                      <span className="flex-shrink-0 text-sm font-semibold tabular-nums">
                        {e.mapViews} {t('admin.stats.mapViews')}
                      </span>
                    </button>
                    {isActive && (
                      <SignalTrend
                        series={eventSeries}
                        label={e.title}
                        unit={t('admin.stats.mapViews')}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="mt-1 text-xs opacity-70">{t('admin.stats.mapViewsNote')}</p>
      </section>
    </div>
  );
}
