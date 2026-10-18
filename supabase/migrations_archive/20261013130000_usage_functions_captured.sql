-- The usage functions exactly as production runs them, captured on 2026-10-13
-- with pg_get_functiondef, plus the EXECUTE grants has_function_privilege
-- reported for anon and authenticated at the same moment.
--
-- NO BEHAVIOUR CHANGE, and it never needs applying: run against production it
-- replaces each function with itself. It exists so the repository can rebuild
-- the numbers on the admin console. Until now the latest definition of each
-- function was spread over six migrations, and production had been edited by
-- hand at least once (usage_stats_unchecked, September 2026), so "what does the
-- console count" could only be answered by reading the live database.
--
-- Bodies are verbatim, comments included, so a diff against a later migration
-- shows only what that migration changed.

-- usage_suppress_groups(jsonb): anon may not execute; authenticated may not.
CREATE OR REPLACE FUNCTION public.usage_suppress_groups(p_groups jsonb)
 RETURNS json
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  n bigint;
  hidden_cnt int := 0;
  hidden_sum bigint := 0;
  rank int := 0;
  cutoff int := 0;
  grand_total bigint;
begin
  -- A breakdown of a sub-floor population tells you everything about it, and
  -- the loop below cannot help: with a SINGLE bucket the bucket IS the total,
  -- so replacing it with -1 hides nothing once the total is published beside
  -- it. That case arises exactly when the group total is itself under the
  -- floor. Publish no breakdown at all there — the bare total stays, carrying
  -- no dimension to narrow on, which is the same line today/d7/d30 hold.
  select coalesce(sum((e->>'n')::bigint), 0) into grand_total
    from jsonb_array_elements(p_groups) e;
  if grand_total < 5 then
    return '[]'::json;
  end if;

  for n in
    select (e->>'n')::bigint from jsonb_array_elements(p_groups) e
     order by (e->>'n')::bigint asc
  loop
    rank := rank + 1;
    if n < 5 or hidden_cnt = 1 or (hidden_cnt > 0 and hidden_sum < 5) then
      hidden_cnt := hidden_cnt + 1;
      hidden_sum := hidden_sum + n;
      cutoff := rank;
    else
      exit;
    end if;
  end loop;

  return coalesce((
    select json_agg(json_build_object(
             'key', key, 'devices', case when rn <= cutoff then -1 else cnt end
           ) order by cnt desc)
      from (
        select e->>'key' as key,
               (e->>'n')::bigint as cnt,
               row_number() over (order by (e->>'n')::bigint asc) as rn
          from jsonb_array_elements(p_groups) e
      ) ranked
  ), '[]'::json);
end $function$;

revoke all on function public.usage_suppress_groups(jsonb) from public, anon, authenticated;

-- track_daily_usage(text,text,text,text,text): anon may execute; authenticated may.
CREATE OR REPLACE FUNCTION public.track_daily_usage(p_student_id text, p_faculty text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_programme text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := case when upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
  v_programme text := case when upper(btrim(coalesce(p_programme, ''))) ~ '^[A-Z]-[A-Z0-9]{1,10}$'
                       then upper(btrim(p_programme)) end;
  v_app_version text := case when btrim(coalesce(p_app_version, '')) ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
                         then btrim(p_app_version) end;
  v_day date := (now() at time zone 'Europe/Prague')::date;
begin
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform, programme, app_version)
  values (p_student_id, v_day, 1, v_faculty, v_platform, v_programme, v_app_version)
  on conflict (student_id, usage_date) do update
    set open_count  = public.daily_active_usage.open_count + 1,
        faculty     = coalesce(excluded.faculty,     public.daily_active_usage.faculty),
        platform    = coalesce(excluded.platform,    public.daily_active_usage.platform),
        programme   = coalesce(excluded.programme,   public.daily_active_usage.programme),
        -- An update installed mid-day: the newer call wins.
        app_version = coalesce(excluded.app_version, public.daily_active_usage.app_version);
end $function$;

revoke all on function public.track_daily_usage(text,text,text,text,text) from public;
grant execute on function public.track_daily_usage(text,text,text,text,text) to anon, authenticated;

-- usage_stats_unchecked(integer,date): anon may not execute; authenticated may not.
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

revoke all on function public.usage_stats_unchecked(integer,date) from public, anon, authenticated;

-- usage_stats(integer,date): anon may not execute; authenticated may.
CREATE OR REPLACE FUNCTION public.usage_stats(p_days integer, p_day date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_stats_unchecked(p_days, p_day);
end $function$;

revoke all on function public.usage_stats(integer,date) from public, anon, authenticated;
grant execute on function public.usage_stats(integer,date) to authenticated;

-- usage_programmes_unchecked(integer): anon may not execute; authenticated may not.
CREATE OR REPLACE FUNCTION public.usage_programmes_unchecked(p_days integer)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  now_day as (select (now() at time zone 'Europe/Prague')::date as d),
  span as (select greatest(1, least(coalesce(p_days, 30), 365)) as n),
  win as (
    select u.* from public.daily_active_usage u, now_day t, span
     where u.usage_date >= greatest(date '2026-09-07', t.d - (span.n - 1))
       and u.platform is distinct from 'web'
  ),
  latest as (
    select distinct on (student_id) student_id, faculty, programme
      from win where faculty is not null
     order by student_id, usage_date desc
  ),
  grouped as (
    select faculty || ' ' || coalesce(programme, '?') as key, count(*) as n
      from latest
     group by 1
  )
  select public.usage_suppress_groups(
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from grouped), '[]'::jsonb));
$function$;

revoke all on function public.usage_programmes_unchecked(integer) from public, anon, authenticated;

-- usage_programmes(integer): anon may not execute; authenticated may.
CREATE OR REPLACE FUNCTION public.usage_programmes(p_days integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_programmes_unchecked(p_days);
end $function$;

revoke all on function public.usage_programmes(integer) from public, anon, authenticated;
grant execute on function public.usage_programmes(integer) to authenticated;

-- usage_retention_unchecked(): anon may not execute; authenticated may not.
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

revoke all on function public.usage_retention_unchecked() from public, anon, authenticated;

-- usage_retention(): anon may not execute; authenticated may.
CREATE OR REPLACE FUNCTION public.usage_retention()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_retention_unchecked();
end $function$;

revoke all on function public.usage_retention() from public, anon, authenticated;
grant execute on function public.usage_retention() to authenticated;

notify pgrst, 'reload schema';
