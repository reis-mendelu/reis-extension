-- Partner field targeting (spec docs/superpowers/specs/2026-10-09-partner-field-targeting-design.md).
--
-- A partner is a societies row with kind = 'partner' and an audience: faculty
-- tokens ('pef') or faculty:programme tokens ('pef:B-OI'). The app matches the
-- audience ON THE DEVICE; nothing about a student reaches a partner.
--
-- Additive and defaulted: released builds select explicit columns and ignore
-- these, and still call track_daily_usage with one or three arguments.
--
-- The track_daily_usage body below is production's as read with
-- pg_get_functiondef on 2026-10-09 (identical to 20260915130000), plus the
-- programme label.

-- An audience token is 'mendelu' (everyone), or a faculty key optionally
-- followed by ':' and a BASE study-programme code. Must stay identical to
-- AUDIENCE_TOKEN_RE in src/utils/partnerAudience.ts. A NULL element is rejected
-- explicitly: `NULL !~ re` is NULL, which NOT EXISTS would let through.
create or replace function public.societies_audience_valid(p text[])
returns boolean language sql immutable as $$
  select p is null or (
    cardinality(p) > 0 and not exists (
      select 1 from unnest(p) t
       where t is null or t !~ '^(mendelu|(pef|af|ldf|zf|frrms)(:[A-Z]-[A-Z0-9]{1,10})?)$'))
$$;

alter table public.societies
  add column if not exists kind text not null default 'society'
    check (kind in ('society','partner')),
  add column if not exists audience text[]
    check (public.societies_audience_valid(audience)),
  -- A partner's wide colour mark, transparent PNG, same bucket and naming as
  -- logo_path. Required for a partner by the console form, not here, so the
  -- EY backfill below is valid before its marks are uploaded.
  add column if not exists mark_light_path text
    check (mark_light_path is null or mark_light_path ~ ('^' || id || '/[0-9a-f]{32}\.png$')),
  add column if not exists mark_dark_path text
    check (mark_dark_path is null or mark_dark_path ~ ('^' || id || '/[0-9a-f]{32}\.png$'));

alter table public.societies
  add constraint societies_partner_has_audience check (kind <> 'partner' or audience is not null);

-- EY was the first partner, shown to all of PEF; that stays exactly as it is.
update public.societies set kind = 'partner', audience = '{pef}' where id = 'ey';

-- Programme on the anonymous daily count: the BASE study-programme code (B-OI,
-- not B-OI-ZBOI), an aggregate label like faculty. Checked at the column so no
-- write path can store an arbitrary string. Must stay identical to PROGRAMME_RE
-- in src/utils/partnerAudience.ts.
alter table public.daily_active_usage
  add column if not exists programme text
    check (programme is null or programme ~ '^[A-Z]-[A-Z0-9]{1,10}$');

-- One function must remain: two overloads would make PostgREST's named-argument
-- dispatch ambiguous for the 1- and 3-argument calls released clients make.
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
  p_programme text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := case when upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
  v_programme text := case when upper(btrim(coalesce(p_programme, ''))) ~ '^[A-Z]-[A-Z0-9]{1,10}$'
                       then upper(btrim(p_programme)) end;
  v_day date := (now() at time zone 'Europe/Prague')::date;
begin
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform, programme)
  values (p_student_id, v_day, 1, v_faculty, v_platform, v_programme)
  on conflict (student_id, usage_date) do update
    set open_count = public.daily_active_usage.open_count + 1,
        faculty    = coalesce(excluded.faculty,   public.daily_active_usage.faculty),
        platform   = coalesce(excluded.platform,  public.daily_active_usage.platform),
        programme  = coalesce(excluded.programme, public.daily_active_usage.programme);
end $$;
revoke all on function public.track_daily_usage(text, text, text, text) from public;
grant execute on function public.track_daily_usage(text, text, text, text) to anon, authenticated;

-- Devices per faculty+programme over the window, keyed 'PEF B-OI'; 'PEF ?' =
-- faculty known, programme never sent (a build older than this) or not parsed.
-- Same reporting filter and window clamp as usage_stats_unchecked (epoch
-- 2026-09-07, 'web' = the dev server excluded), and the same one-bucket-per-
-- device rule, found once with DISTINCT ON (a correlated lookup per device
-- timed out there). Faculty and programme come from the SAME row — the
-- device's latest row with a faculty — so a device that moved from PEF/B-OI to
-- ZF is counted under 'ZF ?', never under a 'ZF B-OI' it never reported.
create or replace function public.usage_programmes_unchecked(p_days int)
returns json language sql stable security definer set search_path = public as $$
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
$$;
revoke all on function public.usage_programmes_unchecked(int) from public, anon, authenticated;

create or replace function public.usage_programmes(p_days int)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_programmes_unchecked(p_days);
end $$;
revoke all on function public.usage_programmes(int) from public, anon;
grant execute on function public.usage_programmes(int) to authenticated;

notify pgrst, 'reload schema';
