-- Which school a row came from, part 3c: feature stats and the "Pro školu"
-- card count MENDELU only. Overview in 20261117130000_school_columns.sql. Bodies are the
-- newest ones verbatim with `school = 'mendelu'` added.

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
