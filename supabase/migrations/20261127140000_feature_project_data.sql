-- Project data link counter (2026-11-28): one label, `project_data_opened`.
--
-- Sent when a student on Otevřená informatika or Aplikovaná informatika taps the
-- "Data pro projekt" line on an open odevzdávárna (EBC-VWA, EBC-PJ), so we can see
-- whether the datasets are wanted. The random install id plus a fixed label, one
-- row per install per day, once per app session. No new table, no new identifier,
-- no subject and no box. No partner is involved, so one label.
--
-- Additive and safe for every released build: a wider whitelist, nothing existing
-- changes, and no released build sends the new label. Apply it BEFORE the build
-- that does. No begin/commit. Safe to re-run.

CREATE OR REPLACE FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey','app_update_opened','study_aids_click_mendelu_app','study_aids_click_discord_b_oi','study_aids_click_discord_b_aii','screen_exams','screen_study_plan','screen_documents','screen_isic','screen_library','library_booking_made','reis_for_claude_guide_opened','critical_update_shown','critical_update_opened','project_data_opened') then
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
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey','app_update_opened','study_aids_click_mendelu_app','study_aids_click_discord_b_oi','study_aids_click_discord_b_aii','screen_exams','screen_study_plan','screen_documents','screen_isic','screen_library','library_booking_made','reis_for_claude_guide_opened','critical_update_shown','critical_update_opened','project_data_opened') then
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
  check (feature in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey','app_update_opened','study_aids_click_mendelu_app','study_aids_click_discord_b_oi','study_aids_click_discord_b_aii','screen_exams','screen_study_plan','screen_documents','screen_isic','screen_library','library_booking_made','reis_for_claude_guide_opened','critical_update_shown','critical_update_opened','project_data_opened'));
