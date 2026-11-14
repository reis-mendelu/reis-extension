-- Which school a row came from (the "send-only" step for other UIS schools;
-- research/multi-school-supabase.md §7 step 1). reIS is being prepared for
-- universities on the same IS software, VŠE first. Before any of them sends a
-- row, the database has to be able to tell a MENDELU row from theirs, and every
-- figure shown about MENDELU has to stay MENDELU's.
--
-- 1. A `school` column on daily_active_usage, feature_usage and suggestions:
--    not null, default 'mendelu', one of the known ids. Every row written so far,
--    and every row a released build writes from now on, is MENDELU's, and the
--    default records exactly that.
--
-- 2. Three NEW functions that take the school: track_daily_usage_v2,
--    track_feature_usage_v2 and submit_suggestion_v4. New names, never a new
--    defaulted parameter on the old ones: PostgreSQL would keep both overloads,
--    and the named-argument call a released build makes would then match two
--    functions and fail with "could not choose the best candidate function".
--    The old functions are untouched and keep their grants, so released builds
--    go on calling them and their rows land as 'mendelu' through the default.
--    The school is required and checked: a missing or unknown id stores nothing
--    rather than falling back to 'mendelu', which would put another school's
--    rows into MENDELU's figures.
--
--    For a school other than MENDELU, faculty and programme are stored as null.
--    VŠE's header does not parse into them today, the faculty whitelist and the
--    table CHECK know MENDELU's faculties only (and ČZU has a PEF of its own),
--    and school + platform + app version is the tightest label set to start
--    with. Accepting them is a later, separate step.
--
-- 3. The admin and stats functions count MENDELU only, in place: same
--    signatures, same attributes, same JSON shape, and CREATE OR REPLACE keeps
--    their owners and grants, so consoles already released show correct numbers
--    without an update. Only the telemetry tables are filtered here; the
--    content tables (posts, map views, questions) get a school in a later step,
--    and every row in them is MENDELU's until then.
--
-- Additive for every released build: three columns with a default, a CHECK on
-- each that every existing row passes, three new functions, and filters that
-- change nothing while every row is 'mendelu'. Nothing new is collected from MENDELU
-- students; a school label is the same on every install of it.

-- 1. Columns ---------------------------------------------------------------------

alter table public.daily_active_usage
  add column if not exists school text not null default 'mendelu';
alter table public.daily_active_usage
  drop constraint if exists daily_active_usage_school_check,
  add constraint daily_active_usage_school_check check (school in ('mendelu', 'vse', 'czu'));

alter table public.feature_usage
  add column if not exists school text not null default 'mendelu';
alter table public.feature_usage
  drop constraint if exists feature_usage_school_check,
  add constraint feature_usage_school_check check (school in ('mendelu', 'vse', 'czu'));

alter table public.suggestions
  add column if not exists school text not null default 'mendelu';
alter table public.suggestions
  drop constraint if exists suggestions_school_check,
  add constraint suggestions_school_check check (school in ('mendelu', 'vse', 'czu'));

-- 2. Write path --------------------------------------------------------------------
--
-- track_daily_usage (baseline) with the school. The ON CONFLICT update only
-- touches a row of the same school: one install id seen at two schools on one
-- day (possible only if a future build shared the id between them) must never
-- rewrite MENDELU's row with another school's labels.

create or replace function public.track_daily_usage_v2(
  p_student_id  text,
  p_school      text,
  p_faculty     text default null,
  p_platform    text default null,
  p_programme   text default null,
  p_app_version text default null
) returns void
language plpgsql
security definer
set search_path = public
as $_$
declare
  v_mendelu  boolean := p_school = 'mendelu';
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := case when v_mendelu and upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
  v_programme text := case when v_mendelu and upper(btrim(coalesce(p_programme, ''))) ~ '^[A-Z]-[A-Z0-9]{1,10}$'
                       then upper(btrim(p_programme)) end;
  v_app_version text := case when btrim(coalesce(p_app_version, '')) ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
                         then btrim(p_app_version) end;
  v_day date := (now() at time zone 'Europe/Prague')::date;
begin
  if p_school is null or p_school not in ('mendelu', 'vse', 'czu') then
    raise exception 'unknown school' using errcode = '22023';
  end if;
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform, programme, app_version, school)
  values (p_student_id, v_day, 1, v_faculty, v_platform, v_programme, v_app_version, p_school)
  on conflict (student_id, usage_date) do update
    set open_count  = public.daily_active_usage.open_count + 1,
        faculty     = coalesce(excluded.faculty,     public.daily_active_usage.faculty),
        platform    = coalesce(excluded.platform,    public.daily_active_usage.platform),
        programme   = coalesce(excluded.programme,   public.daily_active_usage.programme),
        -- An update installed mid-day: the newer call wins.
        app_version = coalesce(excluded.app_version, public.daily_active_usage.app_version)
    where public.daily_active_usage.school = excluded.school;
end $_$;

-- Same grants as track_daily_usage. `revoke … from public` alone leaves
-- Supabase's default EXECUTE for anon and authenticated, so they are named.
revoke all on function public.track_daily_usage_v2(text, text, text, text, text, text) from public;
grant execute on function public.track_daily_usage_v2(text, text, text, text, text, text) to anon, authenticated, service_role;

-- track_feature_usage (20261107120000_feature_screen_signals.sql) with the
-- school. Same whitelist, same Prague day.
create or replace function public.track_feature_usage_v2(
  p_install_id text,
  p_feature    text,
  p_school     text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_school is null or p_school not in ('mendelu', 'vse', 'czu') then
    raise exception 'unknown school' using errcode = '22023';
  end if;
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits, school)
  values (p_install_id, (now() at time zone 'Europe/Prague')::date, p_feature, 1, p_school)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1
    where public.feature_usage.school = excluded.school;
end;
$$;

revoke all on function public.track_feature_usage_v2(text, text, text) from public;
grant execute on function public.track_feature_usage_v2(text, text, text) to anon, authenticated, service_role;

-- submit_suggestion_v3 (20261018130000_report_context_keep_attachments.sql),
-- verbatim, plus the school. v3 stays as it is for released builds. The school
-- sits with the required parameters: a parameter after the defaulted ones would
-- itself need a default. Same answers: 'ok' | 'ok_without_screenshot' | 'rejected'.
create or replace function public.submit_suggestion_v4(
  p_type            text,
  p_title           text,
  p_body            text,
  p_screen          text,
  p_school          text,
  p_contact         text  default null,
  p_ext_version     text  default '',
  p_browser_name    text  default '',
  p_browser_version text  default '',
  p_viewport        text  default '',
  p_diagnostics     jsonb default null,
  p_screenshot      text  default null,
  p_platform        text  default '',
  p_os_version      text  default ''
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title      text := btrim(coalesce(p_title, ''));
  v_body       text := btrim(coalesce(p_body, ''));
  v_contact    text := nullif(btrim(coalesce(p_contact, '')), '');
  v_screen     text := btrim(coalesce(p_screen, ''));
  v_id         bigint;
  v_shot       bytea;
  v_diag       jsonb := p_diagnostics;
  v_shot_lost  boolean := false;
  v_recent     int;
begin
  if p_school is null or p_school not in ('mendelu', 'vse', 'czu') then
    return 'rejected';
  end if;
  if p_type is null or p_type not in ('bug', 'idea', 'other') then
    return 'rejected';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    return 'rejected';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return 'rejected';
  end if;
  if v_contact is not null and char_length(v_contact) > 120 then
    return 'rejected';
  end if;
  if char_length(v_screen) < 1 or char_length(v_screen) > 40 then
    return 'rejected';
  end if;

  if not public.check_and_log_suggestion_bucket(
    coalesce(nullif(btrim(p_browser_name), ''), 'unknown') || '|' ||
    coalesce(nullif(btrim(p_browser_version), ''), 'unknown')
  ) then
    return 'rejected';
  end if;

  insert into public.suggestions (
    type, title, body, contact, screen,
    ext_version, browser_name, browser_version, viewport,
    platform, os_version, school
  ) values (
    p_type, v_title, v_body, v_contact, v_screen,
    left(coalesce(p_ext_version, ''), 20),
    left(coalesce(p_browser_name, ''), 20),
    left(coalesce(p_browser_version, ''), 10),
    left(coalesce(p_viewport, ''), 20),
    left(btrim(coalesce(p_platform, '')), 20),
    left(btrim(coalesce(p_os_version, '')), 40),
    p_school
  ) returning id into v_id;

  -- Screenshot: decode, check, and hold to a GLOBAL budget of 30 an hour. The
  -- flood guard above is per browser|version and allows 100 an hour; at 600 KB
  -- each that is 60 MB an hour from one looping client, so images get their
  -- own, much smaller, allowance. It matters more now that they are kept.
  if p_screenshot is not null then
    begin
      v_shot := decode(p_screenshot, 'base64');
    exception when others then
      v_shot := null;
    end;
    if v_shot is null
       or octet_length(v_shot) > 614400
       or substring(v_shot from 1 for 3) <> '\xffd8ff'::bytea then
      v_shot := null;
    else
      perform pg_advisory_xact_lock(hashtext('suggestion_attachments.screenshot_budget'));
      select count(*) into v_recent
        from public.suggestion_attachments
       where has_screenshot and created_at > now() - interval '1 hour';
      if v_recent >= 30 then
        v_shot := null;
      end if;
    end if;
    v_shot_lost := v_shot is null;
  end if;

  if v_diag is not null and not (
       jsonb_typeof(v_diag) = 'object'
       and jsonb_typeof(v_diag -> 'entries') = 'array'
       and jsonb_array_length(v_diag -> 'entries') <= 50
       and octet_length(v_diag::text) <= 32768) then
    v_diag := null;
  end if;

  if v_shot is not null or v_diag is not null then
    insert into public.suggestion_attachments (suggestion_id, screenshot, diagnostics)
    values (v_id, v_shot, v_diag);
  end if;

  return case when v_shot_lost then 'ok_without_screenshot' else 'ok' end;
end;
$$;

-- Same grants as v3.
revoke all on function public.submit_suggestion_v4(text, text, text, text, text, text, text, text, text, text, jsonb, text, text, text) from public;
grant execute on function public.submit_suggestion_v4(text, text, text, text, text, text, text, text, text, text, jsonb, text, text, text) to anon, authenticated;

-- 3. Stats count MENDELU only, in place -------------------------------------------
--
-- Each body below is the newest one, verbatim, with `school = 'mendelu'` added
-- where it reads daily_active_usage or feature_usage. Signatures, defaults,
-- language, volatility, SECURITY DEFINER (or not) and search_path are restated
-- exactly; CREATE OR REPLACE keeps owners and grants.

-- get_unique_active_users (baseline): a legacy counter anon can still call; no build since v5.2.5 does.
CREATE OR REPLACE FUNCTION "public"."get_unique_active_users"("p_days" integer) RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT count(DISTINCT student_id)::integer
    FROM public.daily_active_usage
    WHERE usage_date >= current_date - greatest(p_days, 1)
      AND school = 'mendelu';
$$;

-- get_usage_stats (baseline): the same.
CREATE OR REPLACE FUNCTION "public"."get_usage_stats"("p_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT jsonb_build_object(
        'distinctByPeriod', (
            SELECT jsonb_agg(
                jsonb_build_object('days', d, 'count', (
                    SELECT count(DISTINCT student_id)
                    FROM public.daily_active_usage
                    WHERE usage_date >= current_date - d
                      AND school = 'mendelu'
                ))
                ORDER BY d
            )
            FROM unnest(ARRAY[7, 14, 21, 30]) AS d
        ),
        'dailyTrend', (
            SELECT coalesce(
                jsonb_agg(
                    jsonb_build_object('date', usage_date, 'count', c)
                    ORDER BY usage_date
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT usage_date, count(DISTINCT student_id) AS c
                FROM public.daily_active_usage
                WHERE usage_date >= current_date - greatest(p_days, 1)
                  AND school = 'mendelu'
                GROUP BY usage_date
            ) t
        )
    );
$$;

-- usage_programmes_unchecked (baseline).
CREATE OR REPLACE FUNCTION "public"."usage_programmes_unchecked"("p_days" integer) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with
  now_day as (select (now() at time zone 'Europe/Prague')::date as d),
  span as (select greatest(1, least(coalesce(p_days, 30), 365)) as n),
  win as (
    select u.* from public.daily_active_usage u, now_day t, span
     where u.usage_date >= greatest(date '2026-09-07', t.d - (span.n - 1))
       and u.platform is distinct from 'web'
       and u.school = 'mendelu'
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
$$;

-- usage_retention_unchecked (baseline).
CREATE OR REPLACE FUNCTION "public"."usage_retention_unchecked"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with
  shown as (
    select u.student_id, u.usage_date
      from public.daily_active_usage u
     where u.usage_date >= date '2026-09-07'
       and u.platform is distinct from 'web'
       and u.school = 'mendelu'
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null and v.school = 'mendelu')
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
$$;

-- usage_stats_unchecked (baseline).
CREATE OR REPLACE FUNCTION "public"."usage_stats_unchecked"("p_days" integer, "p_day" "date" DEFAULT NULL::"date") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
       and u.school = 'mendelu'
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null and v.school = 'mendelu')
  ),

  -- first_seen spans the whole UUID era, not just the reported window, so the
  -- first day of the epoch is not reported as 100% new devices.
  seen as (
    select student_id, min(usage_date) as first_day
      from public.daily_active_usage
     where usage_date >= date '2026-08-29'
       and school = 'mendelu'
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

-- feature_stats_unchecked (20261018120000_feature_stats_event_reach.sql).
CREATE OR REPLACE FUNCTION "public"."feature_stats_unchecked"("p_days" integer) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select current_date - greatest(1, least(coalesce(p_days, 30), 365)) + 1 as from_date
  ),
  win as (
    select f.* from public.feature_usage f, bounds b
     where f.usage_date >= b.from_date and f.school = 'mendelu'
  ),
  per as (
    select feature, count(distinct install_id) as installs, sum(hits)::bigint as hits
      from win group by feature
  ),
  -- Only features that cleared the floor; see the note above.
  publishable as (
    select feature from per where installs >= 5
  ),
  per_day as (
    select w.usage_date, w.feature, count(distinct w.install_id) as installs
      from win w
     where w.feature in (select feature from publishable)
     group by 1, 2
  ),
  ev as (
    select e.event_id, sum(e.views)::bigint as views
      from public.event_map_views e, bounds b
     where e.view_date >= b.from_date
     group by e.event_id
  ),
  top as (
    select ev.event_id, s.title, ev.views
      from ev join public.spolky_events s on s.id = ev.event_id
     order by ev.views desc, s.title
     limit 10
  ),
  -- One row per post that anyone saw, from EITHER surface. Driven from
  -- spolky_events with a LEFT JOIN: `top` above is an inner join capped at ten
  -- by map opens, which drops exactly the posts this exists to show (a lot of
  -- Novinky reach, few map opens). Map opens are summed over ALL days, not
  -- p_days, because view_count/click_count are since publication and cannot be
  -- windowed; the two must cover the same span to sit in one row.
  reach as (
    select s.id, s.title, s.association_id, s.kind, s.view_count, s.click_count,
           coalesce(m.views, 0)::bigint as map_views
      from public.spolky_events s
      left join (
        select event_id, sum(views) as views from public.event_map_views group by event_id
      ) m on m.event_id = s.id
     where s.view_count > 0 or s.click_count > 0 or coalesce(m.views, 0) > 0
  ),
  ev_day as (
    select e.view_date, e.event_id, e.views
      from public.event_map_views e, bounds b
     where e.view_date >= b.from_date
       and e.event_id in (select event_id from top)
  )
  select json_build_object(
    'by_feature', coalesce((select json_agg(json_build_object(
        'feature',  feature,
        'installs', case when installs < 5 then -1 else installs end,
        'hits',     case when installs < 5 then -1 else hits end
      ) order by feature) from per), '[]'::json),
    'daily', coalesce((select json_agg(json_build_object(
        'day',      usage_date,
        'feature',  feature,
        'installs', installs
      ) order by usage_date, feature) from per_day), '[]'::json),
    -- Event titles are society-published public content, not student data, and
    -- this function is reis_admin-only regardless.
    'top_events', coalesce((select json_agg(json_build_object(
        'id',        event_id,
        'title',     title,
        'map_views', views
      ) order by views desc, title) from top), '[]'::json),
    'event_daily', coalesce((select json_agg(json_build_object(
        'day',      view_date,
        'event_id', event_id,
        'views',    views
      ) order by view_date) from ev_day), '[]'::json),
    'event_reach', coalesce((select json_agg(json_build_object(
        'id',             id,
        'title',          title,
        'association_id', association_id,
        'kind',           kind,
        'view_count',     view_count,
        'click_count',    click_count,
        'map_views',      map_views
      ) order by view_count desc, map_views desc, title) from reach), '[]'::json)
  );
$$;

-- school_stats_unchecked (20261030120000_school_stats.sql), the "Pro školu" card.
create or replace function public.school_stats_unchecked() returns json
  language sql stable security definer
  set search_path = ''
as $$
  with
  today as (select (now() at time zone 'Europe/Prague')::date as d),
  -- The last complete Monday–Sunday week, computed arithmetically rather than
  -- with date_trunc, which goes through timestamptz and the session time zone.
  wk as (
    select t.d - (extract(isodow from t.d)::int - 1) - 7 as from_date,
           t.d - (extract(isodow from t.d)::int - 1) - 1 as to_date
      from today t
  ),
  -- The faculty IS last named on each install.
  install_faculty as (
    select distinct on (student_id) student_id, faculty
      from public.daily_active_usage
     where faculty is not null
       and school = 'mendelu'
     order by student_id, usage_date desc
  ),
  -- 'web' is the dev server and the preview, never a student. A device counts
  -- only once IS has named a student on it, as in usage_retention.
  regulars as (
    select u.student_id, bool_or(u.platform in ('ios', 'android')) as phone
      from public.daily_active_usage u, wk
     where u.usage_date between wk.from_date and wk.to_date
       and u.platform is distinct from 'web'
       and u.school = 'mendelu'
       and u.student_id in (select student_id from install_faculty)
     group by u.student_id
    having count(distinct u.usage_date) >= 2
  ),
  edu_counts as (
    select count(distinct install_id) filter (where feature = 'eduroam_wifi_configured') as wifi,
           count(distinct install_id) filter (where feature = 'eduroam_profile_delivered') as profile
      from public.feature_usage
     where feature in ('eduroam_wifi_configured', 'eduroam_profile_delivered')
       and school = 'mendelu'
  ),
  edu as (
    select f.install_id, f.feature, f.usage_date,
           f.usage_date - (extract(isodow from f.usage_date)::int - 1) as week
      from public.feature_usage f
     where f.feature in ('eduroam_wifi_configured', 'eduroam_profile_delivered')
       and f.school = 'mendelu'
  ),
  -- Only notices that have actually been shown: started, with a real window.
  notices as (
    select q.id, q.prompt_cz, q.prompt_en, q.starts_at, q.ends_at,
           coalesce(sum(c.n) filter (where c.key = 'seen'), 0) as seen
      from public.reis_questions q
      left join public.reis_question_counts c on c.question_id = q.id
     where q.starts_at <= now() and q.ends_at > q.starts_at
     group by q.id
    -- Seen by at least one device: a started question nobody was shown is not
    -- a notice the card can report on (release review).
    having coalesce(sum(c.n) filter (where c.key = 'seen'), 0) > 0
  )
  select json_build_object(
    'week_from', (select from_date from wk),
    'week_to', (select to_date from wk),
    'regulars', (select case when count(*) < 10 then -1 else count(*) end from regulars),
    'regulars_phone', (select case when count(*) filter (where phone) < 10 then -1
                                   else count(*) filter (where phone) end from regulars),
    'regulars_by_faculty', public.school_suppress_groups(coalesce((
        select jsonb_agg(jsonb_build_object('key', faculty, 'n', n)) from (
          select f.faculty, count(*) as n
            from regulars r join install_faculty f using (student_id)
           group by 1) g), '[]'::jsonb)),
    'eduroam_since', (select min(usage_date) from edu),
    -- One setup per install, whichever kind: the headline, suppressed on its own
    -- rather than summed from two independently hidden counts.
    'eduroam_total', (select case when n < 10 then -1 else n end from (
        select count(distinct install_id) as n from edu) x),
    -- Phones and laptops only as a pair, both at 10 or more: published beside
    -- the total, either one would give away the other by subtraction.
    'eduroam_wifi', (select case when least(wifi, profile) < 10 then -1 else wifi end from edu_counts),
    'eduroam_profile', (select case when least(wifi, profile) < 10 then -1 else profile end from edu_counts),
    -- Phones and laptops together per faculty: one setup each, whichever device.
    'eduroam_by_faculty', public.school_suppress_groups(coalesce((
        select jsonb_agg(jsonb_build_object('key', faculty, 'n', n)) from (
          select coalesce(i.faculty, 'unknown') as faculty, count(distinct e.install_id) as n
            from edu e left join install_faculty i on i.student_id = e.install_id
           group by 1) g), '[]'::jsonb)),
    -- Society- and partner-published posts: public content, not student data.
    'events', (select json_build_object(
        'posts', count(*),
        'views', coalesce(sum(view_count), 0),
        'clicks', coalesce(sum(click_count), 0),
        'map_views', (select coalesce(sum(views), 0) from public.event_map_views)
      ) from public.spolky_events
       where view_count > 0 or click_count > 0
          or id in (select event_id from public.event_map_views)),
    'notices', coalesce((select json_agg(json_build_object(
        'id', id,
        'prompt_cz', prompt_cz,
        'prompt_en', prompt_en,
        'starts_at', starts_at,
        'ends_at', ends_at,
        'seen', case when seen < 10 then -1 else seen end
      ) order by starts_at desc) from notices), '[]'::json)
  );
$$;
