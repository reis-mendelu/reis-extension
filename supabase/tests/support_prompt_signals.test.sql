begin;

-- every label from before the support prompt is still counted from anon
do $$
declare v_n int;
begin
  set local role anon;
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000001', 'map_dwell_3s');
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000001', 'eduroam_wifi_configured');
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000001', 'eduroam_profile_delivered');
  reset role;
  select count(*) into v_n from public.feature_usage
   where install_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_n is distinct from 3 then raise exception 'existing labels not all counted: %', v_n; end if;
end $$;

-- both new labels are counted from anon, one row per install per day
do $$
declare v_seen int; v_yes int;
begin
  set local role anon;
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000002', 'support_prompt_seen');
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000002', 'support_prompt_seen');
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000002', 'support_prompt_yes');
  reset role;
  select hits into v_seen from public.feature_usage
   where install_id = 'aaaaaaaa-0000-0000-0000-000000000002' and feature = 'support_prompt_seen';
  select hits into v_yes from public.feature_usage
   where install_id = 'aaaaaaaa-0000-0000-0000-000000000002' and feature = 'support_prompt_yes';
  if v_seen is distinct from 2 then raise exception 'support_prompt_seen hits: %', v_seen; end if;
  if v_yes is distinct from 1 then raise exception 'support_prompt_yes hits: %', v_yes; end if;
end $$;

-- an unknown label is dropped silently by the function
do $$
declare v_n int;
begin
  set local role anon;
  perform public.track_feature_usage('aaaaaaaa-0000-0000-0000-000000000003', 'support_prompt_no');
  reset role;
  select count(*) into v_n from public.feature_usage
   where install_id = 'aaaaaaaa-0000-0000-0000-000000000003';
  if v_n is distinct from 0 then raise exception 'unknown label stored: %', v_n; end if;
end $$;

-- and refused by the column check if it is written directly
do $$
begin
  insert into public.feature_usage (install_id, usage_date, feature, hits)
  values ('aaaaaaaa-0000-0000-0000-000000000004', current_date, 'support_prompt_no', 1);
  raise exception 'column check accepted an unknown label';
exception when check_violation then null;
end $$;

rollback;
