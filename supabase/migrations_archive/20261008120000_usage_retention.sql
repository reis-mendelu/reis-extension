-- How many of our regulars we have lost, as one percentage. The daily
-- new/existing split says who opened reIS today; it cannot say whether reIS is
-- kept, because once installs slow down nearly every active device is
-- "existing" by definition.
--
-- APPLIED 2026-10-08 against the linked project (zvbpgkmnrqyprtkyxkwn), before
-- the branch merged — it only creates two new functions, so an old build
-- against the migrated database is unaffected. No CI applies this directory;
-- it is run by hand with `npx supabase db query --linked -f <this file>`,
-- never `db push`.
--
-- Verified after applying: usage_retention_unchecked() returned
-- {regulars_ever: 2435, gone_quiet: 97}; has_function_privilege shows anon
-- without EXECUTE on both and authenticated only on the gated wrapper; and
-- both answer 401 to anon through the public API with the publishable key.
--
-- Definitions (DEVICES — a random per-install UUID — never people):
--   * regular     a device active on >= 2 distinct days of some Monday–Sunday
--                 week (Prague days, as the write path stamps them). Teaching
--                 repeats weekly, so this is "uses reIS", not "tried it once".
--   * gone quiet  a device that was a regular at least once and has not opened
--                 reIS for 14 days or more. A reinstall mints a new id, so it
--                 shows up here too — the share is an upper bound.
--
-- Same reporting filter as usage_stats_unchecked: the 2026-09-07 epoch, and no
-- platform = 'web' rows (only the dev server has ever written that label).
-- Two totals with no dimension to narrow on, like the daily totals in
-- usage_stats.

create or replace function public.usage_retention_unchecked()
returns json language sql stable security definer set search_path = '' as $$
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
$$;

revoke all on function public.usage_retention_unchecked() from public, anon, authenticated;

create or replace function public.usage_retention()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_retention_unchecked();
end $$;

revoke all on function public.usage_retention() from public, anon;
grant execute on function public.usage_retention() to authenticated;

-- PostgREST caches function signatures seen at boot; without this the new RPC
-- 404s until the schema cache next reloads on its own.
notify pgrst, 'reload schema';
