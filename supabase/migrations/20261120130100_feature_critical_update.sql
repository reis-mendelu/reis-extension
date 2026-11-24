-- Critical update pop-up (2026-11-21): two more whitelisted labels for the
-- existing counter. `critical_update_shown` when the phone shows the pop-up
-- that explains a broken old build (at most twice per install), and
-- `critical_update_opened` when the student taps its Update button. The random
-- install id plus a fixed label, one row per install per day. No new table,
-- no new identifier.
--
-- Additive: every label released builds send is still accepted, and the
-- constraint only widens. A released build never sends the new labels, so this
-- is applied before the build that does.

CREATE OR REPLACE FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey','app_update_opened','study_aids_click_mendelu_app','screen_exams','screen_study_plan','screen_documents','screen_isic','screen_library','reis_for_claude_guide_opened','critical_update_shown','critical_update_opened') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits)
  values (p_install_id, (now() at time zone 'Europe/Prague')::date, p_feature, 1)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1;
end;
$$;

-- track_feature_usage_v2 (20261117130100_school_writers.sql), same body, wider list.
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
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey','app_update_opened','study_aids_click_mendelu_app','screen_exams','screen_study_plan','screen_documents','screen_isic','screen_library','reis_for_claude_guide_opened','critical_update_shown','critical_update_opened') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits, school)
  values (p_install_id, (now() at time zone 'Europe/Prague')::date, p_feature, 1, p_school)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1
    where public.feature_usage.school = excluded.school;
end;
$$;

alter table public.feature_usage drop constraint feature_usage_feature_check;
alter table public.feature_usage add constraint feature_usage_feature_check
  check (feature in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey','app_update_opened','study_aids_click_mendelu_app','screen_exams','screen_study_plan','screen_documents','screen_isic','screen_library','reis_for_claude_guide_opened','critical_update_shown','critical_update_opened'));
