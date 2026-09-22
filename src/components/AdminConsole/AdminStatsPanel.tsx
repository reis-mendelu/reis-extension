import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { StatsBars } from './StatsBars';
import { DailyActivityChart } from './DailyActivityChart';
import { DayDetail } from './DayDetail';
import { FeatureSignals } from './FeatureSignals';

/**
 * Counts of DEVICES, never people — the note under the tiles says so, and the
 * wording is load-bearing rather than decorative: one student on a phone and a
 * laptop is two, and reIS has no way to know otherwise without identifying the
 * student, which it will not do.
 *
 * Design and the excluded-history reasoning:
 * docs/superpowers/specs/2026-09-15-admin-usage-stats-design.md
 */
export function AdminStatsPanel() {
  const { t } = useTranslation();
  const stats = useAppStore((s) => s.adminStats);
  const loading = useAppStore((s) => s.adminStatsLoading);
  const selectedDay = useAppStore((s) => s.adminStatsDay);
  const reload = useAppStore((s) => s.loadAdminStats);
  const pickDay = useAppStore((s) => s.selectAdminStatsDay);
  const label = (k: string) => (k === 'unknown' ? t('admin.stats.unknown') : k);
  const today = stats?.daily.at(-1) ?? null;

  // --color-warning-content is now #111827 in both themes (index.css),
  // 8.26:1 on --color-warning — the DaisyUI alert-warning fill already
  // carries readable text, no override needed.
  if (!stats && !loading)
    return <div className="alert alert-warning m-2 text-sm">{t('admin.stats.loadFailed')}</div>;
  if (!stats) return <span className="loading loading-dots loading-sm m-4" />;

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="stats stats-horizontal shadow-sm">
          {(
            [
              ['today', stats.today],
              ['d7', stats.d7],
              ['d30', stats.d30],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="stat p-3">
              <div className="stat-title text-xs">{t(`admin.stats.${k}`)}</div>
              <div className="stat-value text-2xl">{v}</div>
              {/* "86 today" says nothing about whether reIS is being discovered
                  or actually kept, which is the question the redesign exists to
                  answer. The RPC's date spine always ends on today, so the last
                  daily row is today's — but an empty window must not crash the
                  tile. */}
              {k === 'today' && today && (
                <div className="stat-desc text-xs">
                  {today.newDevices} {t('admin.stats.new')} · {today.returningDevices}{' '}
                  {t('admin.stats.returning')}
                </div>
              )}
            </div>
          ))}
        </div>
        <span className="text-xs opacity-60">{t('admin.stats.epochNote')}</span>
      </div>
      <p className="text-xs opacity-70">{t('admin.stats.devicesNote')}</p>

      <section>
        <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.daily')}</h4>
        <DailyActivityChart
          daily={stats.daily}
          selectedDay={selectedDay}
          onPick={(d) => void pickDay(d)}
        />
      </section>

      {stats.day && <DayDetail detail={stats.day} />}

      {/* Loaded by the same `loadAdminStats` action, from its own RPC, and
          renders nothing until it arrives — so a failed feature read costs the
          usage numbers above nothing. */}
      <FeatureSignals />

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byPlatform')}</h4>
          <StatsBars groups={stats.byPlatform} labelFor={label} under5={t('admin.stats.under5')} />
        </section>
        <section>
          <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byFaculty')}</h4>
          <StatsBars groups={stats.byFaculty} labelFor={label} under5={t('admin.stats.under5')} />
        </section>
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-xs self-end"
        aria-label={t('common.refresh')}
        onClick={() => void reload()}
        disabled={loading}
      >
        ↻
      </button>
    </div>
  );
}
