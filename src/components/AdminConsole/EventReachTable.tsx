import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { buildTrendSeries } from '../../utils/trendSeries';
import { SignalTrend } from './SignalTrend';
import type { EventReach } from '../../api/featureStats';

/** The window the trend is drawn over; the RPC's daily map rows span the same. */
const WINDOW_DAYS = 30;
/** Rows shown before "show all". The RPC returns every post with any activity. */
const PREVIEW_ROWS = 15;

const ROW = 'block w-full rounded-lg px-3 py-2 text-left transition-colors border-l-2';
const SELECTED = 'bg-base-300 border-primary';
const UNSELECTED = 'bg-base-200 border-transparent';
const DASH = '—';

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight opacity-70">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * One row per post, both surfaces side by side: how many devices saw it in
 * Novinky, how many taps it got there, and how many times it was opened on the
 * map. All three are since publication, so they cover the same span.
 *
 * COUNTS OF OPENS, never people, and the surfaces are deliberately not joined:
 * nothing records which install looked at which event, so "went from the
 * notification" and "went from the map" are two tallies of one post, not two
 * halves of an audience. The note says so.
 *
 * Taps ÷ views can pass 100 %: views are once per device, taps are every tap.
 */
export function EventReachTable() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const stats = useAppStore((s) => s.adminFeatureStats);
  const societies = useAppStore((s) => s.societies);
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!stats) return null;

  const locale = language === 'cz' ? 'cs' : 'en';
  const num = (n: number) => n.toLocaleString(locale);
  const pct = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const rows = [...stats.eventReach].sort((a, b) => b.views - a.views || b.mapViews - a.mapViews);
  const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
  const hasTrend = (id: string) => stats.eventDaily.some((d) => d.eventId === id);

  const body = (e: EventReach) => (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm">{e.title}</span>
        <span className="flex-shrink-0 text-xs opacity-70">
          {societies[e.societyId]?.name ?? e.societyId}
          {e.kind === 'notice' && ` · ${t('admin.stats.reachNotice')}`}
        </span>
      </div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
        <Cell label={t('admin.stats.reachViews')} value={num(e.views)} />
        <Cell label={t('admin.stats.reachClicks')} value={num(e.clicks)} />
        {/* A notice has no pin; map opens on one predate the event/notice split. */}
        <Cell
          label={t('admin.stats.reachMap')}
          value={e.kind === 'notice' ? DASH : num(e.mapViews)}
        />
        <Cell
          label={t('admin.stats.reachRatio')}
          value={e.views > 0 ? pct.format(e.clicks / e.views) : DASH}
        />
      </dl>
    </>
  );

  return (
    <section>
      <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.reachTitle')}</h4>
      {rows.length === 0 ? (
        <p className="text-sm opacity-60">{t('admin.stats.noData')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((e) => {
            const isOpen = e.id === openId && hasTrend(e.id);
            const cls = `${ROW} ${isOpen ? SELECTED : UNSELECTED}`;
            return (
              <li key={e.id}>
                {hasTrend(e.id) ? (
                  <button
                    type="button"
                    aria-pressed={isOpen}
                    onClick={() => setOpenId(isOpen ? null : e.id)}
                    className={`${cls} hover:bg-base-300`}
                  >
                    {body(e)}
                  </button>
                ) : (
                  <div className={cls}>{body(e)}</div>
                )}
                {isOpen && (
                  <SignalTrend
                    series={buildTrendSeries(
                      stats.eventDaily
                        .filter((d) => d.eventId === e.id)
                        .map((d) => ({ day: d.day, value: d.views })),
                      WINDOW_DAYS,
                      new Date()
                    )}
                    label={e.title}
                    unit={t('admin.stats.mapViews')}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > PREVIEW_ROWS && (
        <button type="button" className="btn btn-ghost btn-xs mt-1" onClick={() => setAll(!all)}>
          {all ? t('admin.stats.reachFewer') : t('admin.stats.reachAll', { count: rows.length })}
        </button>
      )}
      <p className="mt-1 text-xs opacity-70">{t('admin.stats.reachNote')}</p>
    </section>
  );
}
