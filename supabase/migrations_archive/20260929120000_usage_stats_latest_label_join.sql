-- The admin Statistics tab stopped loading its usage numbers ("Could not load
-- statistics."): `usage_stats` ran 9.5 s against the 8 s statement_timeout of
-- the `authenticated` role and was cancelled (57014). The feature signals kept
-- rendering because they come from `feature_stats`, a separate RPC.
--
-- The cost was the `labelled` CTE: two correlated subqueries per device against
-- `win`, a CTE with no index, so it grew with devices x rows and crossed the
-- limit as installs climbed after 21 Sep. This rewrites that CTE only. Same
-- signature, same output (compared as jsonb against the old function on prod
-- data), so released clients are unaffected. Everything else is copied verbatim
-- from 20260915130000_usage_stats_devices.sql.

create or replace function public.usage_stats_unchecked(p_days int, p_day date default null)
returns json
language sql stable security definer set search_path = public as $$
  with
  -- Every window below is anchored to the Prague day, matching the write path.
  now_day as (select (now() at time zone 'Europe/Prague')::date as d),

  -- What the dashboard is allowed to report on.
  --
  -- 2026-09-07 is the epoch. Before 2026-08-29 `student_id` was
  -- SHA-256(IS student id) — a stable per-STUDENT hash, 99 of them, a different
  -- unit from the random per-install UUID that replaced it; counting across that
  -- boundary makes every student "new" on the day the scheme changed. From
  -- 29 Aug to 6 Sept the UUID era is development traffic: StrictMode
  -- double-invokes effects in development builds only, so a dev boot leaves an
  -- EVEN open_count and a production boot an odd one, and 6 Sept alone is 121 of
  -- 127 rows at exactly 2. 2026-09-02..05 is 1188 of 1216 even, and 2 of its
  -- 1207 devices were ever seen again after 9 Sept.
  --
  -- platform = 'web' is the dev server: 164 rows, ZERO with an odd open_count.
  -- Nothing but `npm run dev:web` has ever written that label. If reIS ever
  -- ships a real web app, this exclusion has to be revisited.
  shown as (
    select u.* from public.daily_active_usage u
     where u.usage_date >= date '2026-09-07'
       and u.platform is distinct from 'web'
  ),

  -- first_seen spans the whole UUID era, not just the reported window, so the
  -- first day of the epoch is not reported as 100% new devices.
  seen as (
    select student_id, min(usage_date) as first_day
      from public.daily_active_usage
     where usage_date >= date '2026-08-29'
     group by 1
  ),

  span as (
    select greatest(1, least(coalesce(p_days, 30), 365)) as n from now_day
  ),
  win as (
    select s.* from shown s, now_day t, span
     where s.usage_date >= t.d - (span.n - 1)
  ),

  -- A full date spine, so a day with no activity is a zero rather than a gap
  -- the chart silently closes up.
  days as (
    select gs::date as day
      from now_day t, span,
           generate_series(greatest(date '2026-09-07', t.d - (span.n - 1)), t.d, interval '1 day') gs
  ),
  daily_raw as (
    select w.usage_date as day,
           count(distinct w.student_id) as active,
           count(distinct w.student_id) filter (where f.first_day = w.usage_date) as new_devices,
           count(distinct w.student_id) filter (where f.first_day < w.usage_date) as returning_devices
      from win w join seen f on f.student_id = w.student_id
     group by 1
  ),
  daily as (
    select d.day,
           coalesce(r.active, 0) as active,
           coalesce(r.new_devices, 0) as new_devices,
           coalesce(r.returning_devices, 0) as returning_devices
      from days d left join daily_raw r on r.day = d.day
  ),

  -- One bucket per device, keyed on its most recent non-null label.
  -- Counting distinct student_id per bucket instead put a device whose label
  -- changed (null -> ios, the week the columns were added) into TWO buckets:
  -- the bars summed to 429 against a window total of 423.
  devices as (select distinct student_id from win),
  -- The latest label is found once per device with DISTINCT ON, not by a
  -- subquery per device: `win` is a CTE with no index, so two correlated
  -- lookups against it cost devices x rows. At 2,488 devices and 12,477 rows
  -- (29 Sep 2026) that was 9.5 s, past the 8 s `authenticated` timeout.
  latest_platform as (
    select distinct on (student_id) student_id, platform
      from win where platform is not null
     order by student_id, usage_date desc
  ),
  latest_faculty as (
    select distinct on (student_id) student_id, faculty
      from win where faculty is not null
     order by student_id, usage_date desc
  ),
  labelled as (
    select d.student_id,
           coalesce(p.platform, 'unknown') as platform,
           coalesce(f.faculty, 'unknown') as faculty
      from devices d
      left join latest_platform p on p.student_id = d.student_id
      left join latest_faculty f on f.student_id = d.student_id
  ),
  plat as (select platform as key, count(*) as n from labelled group by 1),
  fac  as (select faculty  as key, count(*) as n from labelled group by 1),

  -- The picked day. Exactly one row per device per day, so bucketing on the
  -- row's own label lands each device once without the latest-label dance.
  pick as (select coalesce(p_day, (select d from now_day)) as d),
  day_rows as (select s.* from shown s, pick p where s.usage_date = p.d),
  day_plat as (
    select coalesce(platform, 'unknown') as key, count(distinct student_id) as n
      from day_rows group by 1
  )

  select json_build_object(
    'today', (select count(distinct student_id) from shown, now_day where usage_date = now_day.d),
    'd7',    (select count(distinct student_id) from shown, now_day where usage_date >= now_day.d - 6),
    'd30',   (select count(distinct student_id) from shown, now_day where usage_date >= now_day.d - 29),

    -- Daily totals carry no dimension to narrow on, so they are not suppressed —
    -- consistent with today/d7/d30, which have never been. Suppression applies
    -- where it does work: the breakdowns, via usage_suppress_groups above.
    'daily', coalesce((select json_agg(json_build_object(
                'day', day, 'active', active, 'new', new_devices, 'returning', returning_devices
              ) order by day) from daily), '[]'::json),

    'by_platform', public.usage_suppress_groups(
                     coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from plat), '[]'::jsonb)),
    'by_faculty',  public.usage_suppress_groups(
                     coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from fac), '[]'::jsonb)),

    'day', (select json_build_object(
              'day', p.d,
              'active', (select count(distinct r.student_id) from day_rows r),
              'new', (select count(distinct r.student_id) from day_rows r
                       join seen f on f.student_id = r.student_id where f.first_day = p.d),
              'returning', (select count(distinct r.student_id) from day_rows r
                             join seen f on f.student_id = r.student_id where f.first_day < p.d),
              'by_platform', public.usage_suppress_groups(
                               coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from day_plat), '[]'::jsonb))
            ) from pick p)
  );
$$;
revoke all on function public.usage_stats_unchecked(int, date) from public, anon, authenticated;
