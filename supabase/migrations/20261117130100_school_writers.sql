-- Which school a row came from, part 2: the write path. Overview in 20261117130000_school_columns.sql.

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
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey') then
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
