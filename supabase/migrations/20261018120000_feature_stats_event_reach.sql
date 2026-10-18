-- feature_stats gains `event_reach`: one row per post with Novinky views, Novinky
-- clicks and map opens side by side, so the admin console can answer "how many
-- came from the notification and how many from the map" per event.
--
-- Additive and safe for every released build: same signature, same grants (CREATE
-- OR REPLACE keeps them), and every key a deployed console reads (`by_feature`,
-- `daily`, `top_events`, `event_daily`) is unchanged. Its client schema is a
-- plain z.object, so an extra key is ignored.
--
-- No identifier is added and no join is made between the counters: all three
-- numbers are per-post aggregates that already exist; this only puts them in
-- one result. Nothing records which install looked at which event.

CREATE OR REPLACE FUNCTION "public"."feature_stats_unchecked"("p_days" integer) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select current_date - greatest(1, least(coalesce(p_days, 30), 365)) + 1 as from_date
  ),
  win as (
    select f.* from public.feature_usage f, bounds b where f.usage_date >= b.from_date
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
