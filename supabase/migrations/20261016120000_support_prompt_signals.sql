-- The "would you support reIS?" willingness-to-pay test (2026-10-16): two more
-- whitelisted labels on the existing feature counters, same shape as the
-- others — the random install id and a fixed label, one row per install per day.
--
--   support_prompt_seen  the question was on screen (the denominator)
--   support_prompt_yes   the student tapped "Ano" (nothing is charged)
--
-- APPLY THIS BEFORE any build that sends them ships: track_feature_usage drops
-- an unknown label silently, so a build ahead of this migration would count
-- zero and read as "nobody wants it". Old builds are unaffected; this only adds
-- values. src/api/__tests__/featureSignalWhitelist.test.ts pins both lists below
-- to the client's FEATURE_SIGNALS.

begin;

-- The column check, by its real name in prod (read 2026-10-16).
alter table public.feature_usage drop constraint feature_usage_feature_check;
alter table public.feature_usage add constraint feature_usage_feature_check
  check (feature in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','support_prompt_seen','support_prompt_yes'));

create or replace function public.track_feature_usage(p_install_id text, p_feature text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered','support_prompt_seen','support_prompt_yes') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits)
  values (p_install_id, current_date, p_feature, 1)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1;
end;
$$;

-- create or replace keeps the existing grants; restated so this file alone
-- describes who may call it.
revoke all on function public.track_feature_usage(text, text) from public;
grant execute on function public.track_feature_usage(text, text) to anon, authenticated;

commit;
