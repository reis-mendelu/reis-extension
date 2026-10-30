import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { StatsBars } from './StatsBars';

/**
 * "Pro školu": the numbers reIS can show MENDELU, from data it already has —
 * regulars by faculty, eduroam set up through reIS, event reach and how many
 * devices saw each Novinky notice. Its own RPC with a floor of 10, so a
 * screenshot of it can leave reIS.
 *
 * Deliberately absent: subject or teacher ratings, usage joined to study
 * results, and counts of IS logins through reIS — see the mendelu-leadership
 * review behind supabase/migrations/20261030120000_school_stats.sql.
 */
/** '2026-10-19' → '19. 10.' — split by hand so no time zone can move the day. */
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}.`;
};
const fullDate = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

export function SchoolStatsCard() {
  const { t } = useTranslation();
  const s = useAppStore((st) => st.adminSchoolStats);
  const language = useAppStore((st) => st.language);
  if (!s) return null;

  const under10 = t('admin.school.under10') as string;
  // The bars' number column is 4rem: "méně než 10" wraps there, "< 10" does not.
  const under10Short = t('admin.school.under10Short') as string;
  const num = (n: number) =>
    n < 0 ? under10 : n.toLocaleString(language === 'cz' ? 'cs-CZ' : 'en-GB');
  const label = (k: string) => (k === 'unknown' ? (t('admin.stats.unknown') as string) : k);

  const tiles = [
    {
      key: 'regulars',
      value: num(s.regulars),
      desc: t('admin.school.regularsDesc', { phone: num(s.regularsPhone) }),
    },
    s.eduroamSince && {
      key: 'eduroam',
      // Both hidden is "under 10", not a made-up 0.
      value: num(
        s.eduroamWifi < 0 && s.eduroamProfile < 0
          ? -1
          : Math.max(s.eduroamWifi, 0) + Math.max(s.eduroamProfile, 0)
      ),
      desc: t('admin.school.eduroamDesc', {
        wifi: num(s.eduroamWifi),
        profile: num(s.eduroamProfile),
        since: fullDate(s.eduroamSince),
      }),
    },
    {
      key: 'events',
      value: num(s.events.posts),
      desc: t('admin.school.eventsDesc', {
        views: num(s.events.views),
        clicks: num(s.events.clicks),
        map: num(s.events.mapViews),
      }),
    },
  ].filter((tile) => !!tile);

  return (
    <section aria-labelledby="school-stats-title" className="card bg-base-200 shadow-sm">
      <div className="card-body gap-3 p-3">
        <div>
          <h4 id="school-stats-title" className="text-sm font-semibold">
            {t('admin.school.title')}
          </h4>
          <span className="text-xs opacity-70">
            {t('admin.school.week', { from: dayMonth(s.weekFrom), to: fullDate(s.weekTo) })}
          </span>
        </div>

        <div className="stats stats-vertical sm:stats-horizontal border border-base-content/10 bg-base-100 shadow-sm">
          {tiles.map((tile) => (
            <div key={tile.key} className="stat p-3">
              <div className="stat-title text-xs">{t(`admin.school.${tile.key}`)}</div>
              <div className="stat-value text-2xl">{tile.value}</div>
              <div className="stat-desc text-xs whitespace-normal">{tile.desc}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {s.regularsByFaculty.length > 0 && (
            <div>
              <h5 className="mb-1 text-xs font-semibold">{t('admin.school.regularsByFaculty')}</h5>
              <StatsBars groups={s.regularsByFaculty} labelFor={label} under5={under10Short} />
            </div>
          )}
          {s.eduroamByFaculty.length > 0 && (
            <div>
              <h5 className="mb-1 text-xs font-semibold">{t('admin.school.eduroamByFaculty')}</h5>
              <StatsBars groups={s.eduroamByFaculty} labelFor={label} under5={under10Short} />
            </div>
          )}
        </div>

        {s.notices.length > 0 && (
          <div>
            <h5 className="mb-1 text-xs font-semibold">{t('admin.school.notices')}</h5>
            <ul className="flex flex-col gap-1 text-sm">
              {s.notices.map((q) => (
                <li key={q.id} className="flex justify-between gap-2">
                  <span className="truncate">{q.prompt}</span>
                  <span className="shrink-0 tabular-nums">{num(q.seen)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs opacity-70">{t('admin.school.note')}</p>
      </div>
    </section>
  );
}
