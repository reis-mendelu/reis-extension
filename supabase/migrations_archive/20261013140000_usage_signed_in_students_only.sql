-- The admin console counts only devices on which IS has named a student.
--
-- 47 devices since the 2026-09-07 epoch never reported a faculty on any day
-- (39 extension, 5 iOS, 3 with no platform label, i.e. builds older than the
-- labels). Most are the extension running for someone with no student record,
-- such as staff: 32 of the 39 were seen on one day and never again.
--
-- Dry-run against production on 2026-10-13, in a block that unwound itself:
--   30 dní 3,220 -> 3,177 · 7 dní 2,438 -> 2,431 · Dnes 1,567 -> 1,564
--   Odešli 145 / 2,538 -> 143 / 2,533 (5.7 % -> 5.6 %)
--   usage_stats_unchecked(30) 317 ms, usage_retention_unchecked() 115 ms.
--
-- The filter is per DEVICE, never per row: a real student's first day often
-- carries a null faculty (params not hydrated yet), and a row filter would drop
-- that day and wrongly mark the next as the device's first.
--
-- The app gates the same thing at the source from the release after this
-- change: trackDailyUsage writes nothing until getUserParams has a studentId.
-- That gate is on the student number, this one on the faculty label, because
-- the label is all the history has. The two disagree only for a student whose
-- faculty IS fails to parse on every day, or whose build predates the labels;
-- 5 of the 47 were regulars, and this filter leaves them out of the history.
--
-- usage_programmes_unchecked already keys on a device's latest row WITH a
-- faculty, so it excludes these devices today and is unchanged.
--
-- Bodies are 20261013130000_usage_functions_captured.sql plus the marked lines.
-- CREATE OR REPLACE keeps the existing grants. Applied by hand with
-- `npx supabase db query --linked -f <this file>`, never `db push`.
--
-- APPLIED 2026-10-13 against the linked project (zvbpgkmnrqyprtkyxkwn), before
-- the branch merged: it changes only what the console reads, so no build is
-- affected. Verified after applying: both functions contain the filter; 30 dní
-- 3,178, Odešli 143 / 2,533; anon and authenticated still cannot execute either
-- _unchecked function, and authenticated still can execute usage_stats().

CREATE OR REPLACE FUNCTION public.usage_stats_unchecked(p_days integer, p_day date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null)
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
$function$;

CREATE OR REPLACE FUNCTION public.usage_retention_unchecked()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with
  shown as (
    select u.student_id, u.usage_date
      from public.daily_active_usage u
     where u.usage_date >= date '2026-09-07'
       and u.platform is distinct from 'web'
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null)
  ),
  -- Monday of each row's week, computed arithmetically rather than with
  -- date_trunc, which goes through timestamptz and the session time zone.
  regulars as (
    select student_id, max(usage_date) as last_day
      from shown
     where student_id in (
       select student_id
         from shown
        group by student_id, usage_date - (extract(isodow from usage_date)::int - 1)
       having count(distinct usage_date) >= 2
     )
     group by 1
  )
  select json_build_object(
    'regulars_ever', (select count(*) from regulars),
    'gone_quiet', (select count(*) from regulars
                    where last_day <= (now() at time zone 'Europe/Prague')::date - 14)
  );
$function$;

notify pgrst, 'reload schema';
