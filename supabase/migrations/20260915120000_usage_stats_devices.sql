-- Counts of DEVICES, reported honestly.
--
-- Background: the console reported 1949 unique installs over 30 days; roughly
-- 320-590 of those were real. The write-path defects are fixed in the app (see
-- the commit "stop counting development boots and sign-outs as installs"); this
-- migration fixes what the dashboard REPORTS about the rows already written.
--
-- Nothing is deleted. The exclusions below are a filter in one place, so the
-- call is reversible and auditable. Full reasoning:
-- docs/superpowers/specs/2026-09-15-admin-usage-stats-design.md

-- The day boundary moves from UTC to Europe/Prague. A student opening reIS at
-- 01:00 on Tuesday in Brno was being counted as Monday. Signature and defaults
-- are unchanged, so released clients calling the one- or three-argument form
-- keep working and PostgREST has nothing new to disambiguate.
create or replace function public.track_daily_usage(
  p_student_id text,
  p_faculty text default null,
  p_platform text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := case when upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
  v_day date := (now() at time zone 'Europe/Prague')::date;
begin
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform)
  values (p_student_id, v_day, 1, v_faculty, v_platform)
  on conflict (student_id, usage_date) do update
    set open_count = public.daily_active_usage.open_count + 1,
        faculty    = coalesce(excluded.faculty,  public.daily_active_usage.faculty),
        platform   = coalesce(excluded.platform, public.daily_active_usage.platform);
end $$;
revoke all on function public.track_daily_usage(text, text, text) from public;
grant execute on function public.track_daily_usage(text, text, text) to anon, authenticated;

-- Both stats functions gain a p_day argument. Drop every existing signature
-- first: adding an argument with a default would otherwise leave two overloads,
-- and PostgREST's named-argument dispatch cannot resolve the one-argument call
-- a released admin console still makes. Same dance as
-- 20260907130000_usage_dimensions.sql.
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace
              and proname in ('usage_stats', 'usage_stats_unchecked')
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

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
  labelled as (
    select d.student_id,
           coalesce((select w.platform from win w
                      where w.student_id = d.student_id and w.platform is not null
                      order by w.usage_date desc limit 1), 'unknown') as platform,
           coalesce((select w.faculty from win w
                      where w.student_id = d.student_id and w.faculty is not null
                      order by w.usage_date desc limit 1), 'unknown') as faculty
      from devices d
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
    -- consistent with today/d7/d30, which have never been. The k=5 floor below
    -- applies where it does work: the breakdowns, where a small faculty on a
    -- rare platform could otherwise be narrowed to one person.
    'daily', coalesce((select json_agg(json_build_object(
                'day', day, 'active', active, 'new', new_devices, 'returning', returning_devices
              ) order by day) from daily), '[]'::json),

    'by_platform', coalesce((select json_agg(json_build_object(
                     'key', key, 'devices', case when n < 5 then -1 else n end
                   ) order by n desc) from plat), '[]'::json),
    'by_faculty',  coalesce((select json_agg(json_build_object(
                     'key', key, 'devices', case when n < 5 then -1 else n end
                   ) order by n desc) from fac), '[]'::json),

    'day', (select json_build_object(
              'day', p.d,
              'active', (select count(distinct r.student_id) from day_rows r),
              'new', (select count(distinct r.student_id) from day_rows r
                       join seen f on f.student_id = r.student_id where f.first_day = p.d),
              'returning', (select count(distinct r.student_id) from day_rows r
                             join seen f on f.student_id = r.student_id where f.first_day < p.d),
              'by_platform', coalesce((select json_agg(json_build_object(
                               'key', key, 'devices', case when n < 5 then -1 else n end
                             ) order by n desc) from day_plat), '[]'::json)
            ) from pick p)
  );
$$;
revoke all on function public.usage_stats_unchecked(int, date) from public, anon, authenticated;

create or replace function public.usage_stats(p_days int, p_day date default null)
returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_stats_unchecked(p_days, p_day);
end $$;
revoke all on function public.usage_stats(int, date) from public, anon;
grant execute on function public.usage_stats(int, date) to authenticated;

notify pgrst, 'reload schema';
