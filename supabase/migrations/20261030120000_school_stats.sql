-- school_stats: the numbers reIS can put in front of MENDELU (the "Pro školu"
-- card in the admin console), all from data reIS already collects.
--
--   regulars  installs IS has named a student on, active on 2+ days of the last
--             complete Mon–Sun week, by faculty, and how many are phones
--   eduroam   installs on which reIS configured eduroam Wi-Fi (phones) or handed
--             over a profile (laptops), since the counter began, by faculty and week
--   events    posts with any reach since publication: Novinky views and clicks, map opens
--   notices   Novinky questions and how many devices saw each one
--
-- Additive and safe for every released build: three new functions, nothing else
-- changes. Nothing new is collected and no identifier leaves the database —
-- every number is an aggregate. This card is meant to be shown outside reIS, so
-- its floor is 10, not the console's 5: a total under 10 comes back as -1, and
-- a breakdown goes through school_suppress_groups, which also hides enough
-- neighbours that a hidden group cannot be recovered by subtraction. The install
-- id joins the feature counters to the faculty label exactly as the privacy
-- policy already states; nothing here joins an install to an event or to a
-- question answer.

-- usage_suppress_groups (baseline) with a floor of 10 instead of 5. Its own
-- function rather than a parameter on the shared one, whose signature deployed
-- consoles depend on.
create or replace function public.school_suppress_groups(p_groups jsonb) returns json
  language plpgsql immutable
  set search_path = ''
as $$
declare
  n bigint;
  hidden_cnt int := 0;
  hidden_sum bigint := 0;
  rank int := 0;
  cutoff int := 0;
  grand_total bigint;
begin
  -- A breakdown of a sub-floor population says everything about it: publish none.
  select coalesce(sum((e->>'n')::bigint), 0) into grand_total
    from jsonb_array_elements(p_groups) e;
  if grand_total < 10 then
    return '[]'::json;
  end if;

  for n in
    select (e->>'n')::bigint from jsonb_array_elements(p_groups) e
     order by (e->>'n')::bigint asc
  loop
    rank := rank + 1;
    if n < 10 or hidden_cnt = 1 or (hidden_cnt > 0 and hidden_sum < 10) then
      hidden_cnt := hidden_cnt + 1;
      hidden_sum := hidden_sum + n;
      cutoff := rank;
    else
      exit;
    end if;
  end loop;

  return coalesce((
    select json_agg(json_build_object(
             'key', key, 'n', case when rn <= cutoff then -1 else cnt end
           ) order by cnt desc, key)
      from (
        select e->>'key' as key,
               (e->>'n')::bigint as cnt,
               row_number() over (order by (e->>'n')::bigint asc, e->>'key') as rn
          from jsonb_array_elements(p_groups) e
      ) ranked
  ), '[]'::json);
end $$;

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
     order by student_id, usage_date desc
  ),
  -- 'web' is the dev server and the preview, never a student. A device counts
  -- only once IS has named a student on it, as in usage_retention.
  regulars as (
    select u.student_id, bool_or(u.platform in ('ios', 'android')) as phone
      from public.daily_active_usage u, wk
     where u.usage_date between wk.from_date and wk.to_date
       and u.platform is distinct from 'web'
       and u.student_id in (select student_id from install_faculty)
     group by u.student_id
    having count(distinct u.usage_date) >= 2
  ),
  edu as (
    select f.install_id, f.feature, f.usage_date,
           f.usage_date - (extract(isodow from f.usage_date)::int - 1) as week
      from public.feature_usage f
     where f.feature in ('eduroam_wifi_configured', 'eduroam_profile_delivered')
  ),
  notices as (
    select q.id, q.prompt_cz, q.starts_at, q.ends_at,
           coalesce(sum(c.n) filter (where c.key = 'seen'), 0) as seen
      from public.reis_questions q
      left join public.reis_question_counts c on c.question_id = q.id
     group by q.id
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
    'eduroam_wifi', (select case when n < 10 then -1 else n end from (
        select count(distinct install_id) as n from edu
         where feature = 'eduroam_wifi_configured') x),
    -- One setup per install, whichever kind: the headline, suppressed on its own
    -- rather than summed from two independently hidden counts.
    'eduroam_total', (select case when n < 10 then -1 else n end from (
        select count(distinct install_id) as n from edu) x),
    'eduroam_profile', (select case when n < 10 then -1 else n end from (
        select count(distinct install_id) as n from edu
         where feature = 'eduroam_profile_delivered') x),
    -- Phones and laptops together per faculty: one setup each, whichever device.
    'eduroam_by_faculty', public.school_suppress_groups(coalesce((
        select jsonb_agg(jsonb_build_object('key', faculty, 'n', n)) from (
          select coalesce(i.faculty, 'unknown') as faculty, count(distinct e.install_id) as n
            from edu e left join install_faculty i on i.student_id = e.install_id
           group by 1) g), '[]'::jsonb)),
    'eduroam_by_week', public.school_suppress_groups(coalesce((
        select jsonb_agg(jsonb_build_object('key', week::text, 'n', n)) from (
          select week, count(distinct install_id) as n from edu group by 1) g), '[]'::jsonb)),
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
        'prompt', prompt_cz,
        'starts_at', starts_at,
        'ends_at', ends_at,
        'seen', case when seen < 10 then -1 else seen end
      ) order by starts_at desc) from notices), '[]'::json)
  );
$$;

create or replace function public.school_stats() returns json
  language plpgsql stable security definer
  set search_path = ''
as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.school_stats_unchecked();
end $$;

-- `revoke … from public` alone leaves Supabase's default EXECUTE for anon and
-- authenticated in place, so both are named.
revoke all on function public.school_suppress_groups(jsonb) from public, anon, authenticated;
grant execute on function public.school_suppress_groups(jsonb) to service_role;
revoke all on function public.school_stats_unchecked() from public, anon, authenticated;
grant execute on function public.school_stats_unchecked() to service_role;
revoke all on function public.school_stats() from public, anon;
grant execute on function public.school_stats() to authenticated, service_role;
