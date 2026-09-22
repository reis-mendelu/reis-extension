-- Three signals reIS could not previously see: whether the campus map is
-- looked at, which society event on it is opened, and whether a student who
-- starts the eduroam setup ever finishes it.
--
-- NOT APPLIED YET. No CI applies this directory — run it by hand against the
-- linked project (`npx supabase db query --linked`, never `db push`).
--
-- Privacy posture, disclosed in PRIVACY.md section 2 and
-- docs/privacy-policy-app.md before this migration was written:
--   * The per-event counter carries an event id and NO identifier at all. The
--     server stamps the date; the request itself carries nothing else.
--   * The two feature counters carry the random per-install UUID
--     (services/identity/installId.ts) and a fixed label from a three-value
--     whitelist. They therefore count INSTALLS, not people — one student on a
--     phone and a laptop is two. Every name here says `install`, never
--     `student`, so no reader can mistake one for the other.
-- Nothing records WHICH event a given install looked at: that pairing would be
-- a behavioural profile, and it is deliberately not representable here.

-- 1. Map views per event, per day ----------------------------------------
-- A dated rollup rather than a counter column on spolky_events. A single
-- integer can only ever answer "143 opens, ever" — no trend can be drawn from
-- it at any later date, because the days were never kept. Summing this table
-- over a window gives the same headline number AND makes it window-scoped,
-- which is the more useful figure: "most opened in the last 30 days" rather
-- than "most opened since the row was created", which merely rewards age.
--
-- It carries no identifier, so it needs no suppression floor: a row says three
-- people opened an event, not which three.
create table if not exists public.event_map_views (
  event_id  uuid not null references public.spolky_events(id) on delete cascade,
  view_date date not null default current_date,
  views     integer not null default 1,
  primary key (event_id, view_date)
);

-- No policies: RLS on with none means only the SECURITY DEFINER functions
-- below reach this table. anon and authenticated cannot read it.
alter table public.event_map_views enable row level security;

create or replace function public.increment_event_map_view(row_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_map_views (event_id, view_date, views)
  values (row_id, current_date, 1)
  on conflict (event_id, view_date)
    do update set views = public.event_map_views.views + 1;
exception
  -- A view of an event that has since been deleted is a race, not a fault, and
  -- it must not surface to a student as a failed request over a counter.
  --
  -- Handled here rather than with a `select 1 from spolky_events` first: an
  -- unlocked existence check is a TOCTOU gap, because `deletePost` can remove
  -- the row between the check and the insert, and the foreign key then raises
  -- anyway. Catching the violation covers the deleted-mid-write case AND the
  -- never-existed case in one, with no lock taken on the event row.
  when foreign_key_violation then
    return;
end;
$$;

revoke all on function public.increment_event_map_view(uuid) from public;
grant execute on function public.increment_event_map_view(uuid) to anon, authenticated;

-- 2. Feature counters ----------------------------------------------------
-- The whitelist is enforced at the column, not just in the function, so no
-- other write path can ever put an arbitrary string here. eduroam is TWO keys
-- on purpose: the native path actually configures the network, while the
-- mac/windows path only hands over a profile the student must still install.
-- One number covering both would overstate how many students are on eduroam.
create table if not exists public.feature_usage (
  -- Random per-install UUID as text, matching daily_active_usage's column type.
  -- Bounded because anon may call the writer below: a client-chosen id must not
  -- become a place to park arbitrary bytes.
  install_id text not null check (char_length(install_id) between 8 and 64),
  usage_date date not null default current_date,
  feature    text not null check (feature in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered')),
  hits       integer not null default 1,
  primary key (install_id, usage_date, feature)
);

alter table public.feature_usage enable row level security;

create or replace function public.track_feature_usage(p_install_id text, p_feature text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits)
  values (p_install_id, current_date, p_feature, 1)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1;
end;
$$;

revoke all on function public.track_feature_usage(text, text) from public;
grant execute on function public.track_feature_usage(text, text) to anon, authenticated;

-- 3. The admin-only read -------------------------------------------------
-- Suppression, and why the daily series is NOT suppressed: usage_stats floors
-- `by_faculty` / `by_platform` — breakdowns by an attribute OF THE PERSON,
-- where a tiny group can be narrowed to an individual — while its own `daily`
-- series is returned raw. A per-day count of a feature carries no attribute at
-- all, so it is raw here too, on the same reasoning.
--
-- What the floor does decide is whether a signal is publishable at all: a
-- feature whose whole window is under 5 installs reports -1 AND gets no daily
-- series, so its shape is never published after its total was withheld.
create or replace function public.feature_stats_unchecked(p_days int)
returns json language sql stable security definer set search_path = '' as $$
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
      ) order by view_date) from ev_day), '[]'::json)
  );
$$;

revoke all on function public.feature_stats_unchecked(int) from public, anon, authenticated;

create or replace function public.feature_stats(p_days int)
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.feature_stats_unchecked(p_days);
end $$;

revoke all on function public.feature_stats(int) from public, anon;
grant execute on function public.feature_stats(int) to authenticated;

-- PostgREST caches function signatures seen at boot; without this the new RPCs
-- 404 for released clients until the schema cache next reloads on its own.
notify pgrst, 'reload schema';
