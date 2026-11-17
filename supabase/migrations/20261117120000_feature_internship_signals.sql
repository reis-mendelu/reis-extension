-- Stáže counters (2026-11-17): "how many installs opened Stáže" and "how many
-- clicked Cesta s EY", the number reIS hands EY. Two more whitelisted labels
-- for the existing counter — the random install id plus a fixed label, one row
-- per install per day; a card clicked twice still only bumps `hits`. No new
-- table, no new identifier, and nothing about which student.
--
-- One click label per partner programme (`internship_click_ey`), not a shared
-- one: the count is given to that partner, so it must be theirs alone.
--
-- Additive: every label released builds send is still accepted, and the
-- constraint only widens. A released build never sends the new labels.

CREATE OR REPLACE FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits)
  values (p_install_id, (now() at time zone 'Europe/Prague')::date, p_feature, 1)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1;
end;
$$;

alter table public.feature_usage drop constraint feature_usage_feature_check;
alter table public.feature_usage add constraint feature_usage_feature_check
  check (feature in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','calendar_week_view','screen_calendar','screen_subjects','screen_menu','screen_search','screen_bulletin','screen_notifications','screen_internships','internship_click_ey'));
