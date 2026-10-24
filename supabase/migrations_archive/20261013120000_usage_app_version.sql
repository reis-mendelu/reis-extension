-- App version on the anonymous daily count: the release the install runs
-- ('5.4.1'). Every install of a release reports the same string, so it is a
-- group label like platform, and answers "which versions are people on",
-- which nothing recorded before this (only feedback reports carried one).
--
-- Additive and defaulted: released builds call track_daily_usage with one,
-- three or four named arguments and keep working; their rows get a NULL
-- version, which reads as "a build older than this migration".
--
-- The track_daily_usage body below is production's as read with
-- pg_get_functiondef on 2026-10-13 (identical to 20261011120000), plus the
-- version label.

-- Checked at the column so no write path can store an arbitrary string.
-- Must stay in step with getAppVersion in src/utils/appIdentity.ts (x.y.z).
alter table public.daily_active_usage
  add column if not exists app_version text
    check (app_version is null or app_version ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$');

-- One function must remain: two overloads would make PostgREST's named-argument
-- dispatch ambiguous for the calls released clients make.
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'track_daily_usage'
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

create or replace function public.track_daily_usage(
  p_student_id text,
  p_faculty text default null,
  p_platform text default null,
  p_programme text default null,
  p_app_version text default null
) returns void
language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.track_daily_usage(text, text, text, text, text) from public;
grant execute on function public.track_daily_usage(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
