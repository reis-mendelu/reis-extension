begin;

-- No overload was added to a function released builds call: one of each name.
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('track_daily_usage', 'track_feature_usage', 'submit_suggestion_v3',
                     'track_daily_usage_v2', 'track_feature_usage_v2', 'submit_suggestion_v4');
  if v_n <> 6 then raise exception 'expected one function per name, found %', v_n; end if;
end $$;

-- Grants: anon and authenticated may call the new functions, as they may the old ones.
do $$ begin
  if not has_function_privilege('anon', 'public.track_daily_usage_v2(text,text,text,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.track_daily_usage_v2(text,text,text,text,text,text)', 'execute')
     or not has_function_privilege('anon', 'public.track_feature_usage_v2(text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.track_feature_usage_v2(text,text,text)', 'execute')
     or not has_function_privilege('anon', 'public.submit_suggestion_v4(text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.submit_suggestion_v4(text,text,text,text,text,text,text,text,text,text,jsonb,text,text,text)', 'execute')
     or not has_function_privilege('anon', 'public.track_daily_usage(text,text,text,text,text)', 'execute')
     or not has_function_privilege('anon', 'public.track_feature_usage(text,text)', 'execute')
     or not has_function_privilege('anon', 'public.submit_suggestion_v3(text,text,text,text,text,text,text,text,text,jsonb,text,text,text)', 'execute') then
    raise exception 'a write function is not callable by anon/authenticated';
  end if;
  -- the stats helpers stay out of reach
  if has_function_privilege('anon', 'public.usage_stats_unchecked(integer,date)', 'execute')
     or has_function_privilege('authenticated', 'public.feature_stats_unchecked(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.school_stats_unchecked()', 'execute') then
    raise exception 'a stats helper became callable';
  end if;
end $$;

-- Daily count -----------------------------------------------------------------------

-- a released build's v1 call lands as MENDELU
do $$
declare v_s text; v_f text;
begin
  set local role anon;
  perform public.track_daily_usage('aaaaaaaa-0000-0000-0000-000000000001', 'PEF', 'ios', 'B-OI', '5.7.1');
  reset role;
  select school, faculty into v_s, v_f from public.daily_active_usage
   where student_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if v_s is distinct from 'mendelu' or v_f is distinct from 'PEF' then
    raise exception 'v1 row: school %, faculty %', v_s, v_f;
  end if;
end $$;

-- v2 'mendelu' keeps MENDELU's faculty whitelist and programme check
do $$
declare v_s text; v_f text; v_p text;
begin
  set local role anon;
  perform public.track_daily_usage_v2('aaaaaaaa-0000-0000-0000-000000000002', 'mendelu', 'af', 'extension', 'b-oi', '5.8.0');
  perform public.track_daily_usage_v2('aaaaaaaa-0000-0000-0000-000000000003', 'mendelu', 'NF', 'extension', 'garbage!', '5.8.0');
  reset role;
  select school, faculty, programme into v_s, v_f, v_p from public.daily_active_usage
   where student_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  if v_s is distinct from 'mendelu' or v_f is distinct from 'AF' or v_p is distinct from 'B-OI' then
    raise exception 'v2 mendelu row: %, %, %', v_s, v_f, v_p;
  end if;
  select faculty, programme into v_f, v_p from public.daily_active_usage
   where student_id = 'aaaaaaaa-0000-0000-0000-000000000003';
  if v_f is not null or v_p is not null then
    raise exception 'v2 mendelu stored an unknown faculty or programme: %, %', v_f, v_p;
  end if;
end $$;

-- v2 'vse' lands as VŠE, with faculty and programme null whatever was sent
do $$
declare v_s text; v_f text; v_p text; v_pl text; v_v text;
begin
  set local role anon;
  perform public.track_daily_usage_v2('bbbbbbbb-0000-0000-0000-000000000001', 'vse', 'PEF', 'android', 'B-EK', '5.8.0');
  reset role;
  select school, faculty, programme, platform, app_version into v_s, v_f, v_p, v_pl, v_v
    from public.daily_active_usage where student_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if v_s is distinct from 'vse' or v_f is not null or v_p is not null
     or v_pl is distinct from 'android' or v_v is distinct from '5.8.0' then
    raise exception 'v2 vse row: %, %, %, %, %', v_s, v_f, v_p, v_pl, v_v;
  end if;
end $$;

-- an unknown or missing school is rejected and stores nothing
do $$
declare v_n int;
begin
  set local role anon;
  begin
    perform public.track_daily_usage_v2('cccccccc-0000-0000-0000-000000000001', 'muni', null, 'ios');
    raise exception 'v2 accepted school muni';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.track_daily_usage_v2('cccccccc-0000-0000-0000-000000000001', null, null, 'ios');
    raise exception 'v2 accepted a null school';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  select count(*) into v_n from public.daily_active_usage where student_id = 'cccccccc-0000-0000-0000-000000000001';
  if v_n <> 0 then raise exception 'a rejected school left % rows', v_n; end if;
  -- and the table itself refuses one
  begin
    insert into public.daily_active_usage (student_id, school) values ('cccccccc-0000-0000-0000-000000000002', 'muni');
    raise exception 'the table accepted school muni';
  exception when check_violation then null;
  end;
end $$;

-- one id at two schools on one day: the MENDELU row is not rewritten
do $$
declare v_s text; v_f text; v_n int; v_pl text;
begin
  set local role anon;
  perform public.track_daily_usage('dddddddd-0000-0000-0000-000000000001', 'PEF', 'ios');
  perform public.track_daily_usage_v2('dddddddd-0000-0000-0000-000000000001', 'vse', null, 'android');
  reset role;
  select school, faculty, open_count, platform into v_s, v_f, v_n, v_pl
    from public.daily_active_usage where student_id = 'dddddddd-0000-0000-0000-000000000001';
  if v_s is distinct from 'mendelu' or v_f is distinct from 'PEF' or v_n <> 1 or v_pl is distinct from 'ios' then
    raise exception 'a VŠE call rewrote the MENDELU row: %, %, %, %', v_s, v_f, v_n, v_pl;
  end if;
end $$;

-- Feature counters ----------------------------------------------------------------

do $$
declare v_s text; v_n int;
begin
  set local role anon;
  perform public.track_feature_usage('eeeeeeee-0000-0000-0000-000000000001', 'screen_menu');
  perform public.track_feature_usage_v2('eeeeeeee-0000-0000-0000-000000000002', 'screen_menu', 'vse');
  perform public.track_feature_usage_v2('eeeeeeee-0000-0000-0000-000000000002', 'screen_menu', 'vse');
  perform public.track_feature_usage_v2('eeeeeeee-0000-0000-0000-000000000003', 'not_a_label', 'vse');
  begin
    perform public.track_feature_usage_v2('eeeeeeee-0000-0000-0000-000000000004', 'screen_menu', 'muni');
    raise exception 'feature v2 accepted school muni';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  select school into v_s from public.feature_usage where install_id = 'eeeeeeee-0000-0000-0000-000000000001';
  if v_s is distinct from 'mendelu' then raise exception 'feature v1 row: %', v_s; end if;
  select school, hits into v_s, v_n from public.feature_usage where install_id = 'eeeeeeee-0000-0000-0000-000000000002';
  if v_s is distinct from 'vse' or v_n <> 2 then raise exception 'feature v2 row: %, %', v_s, v_n; end if;
  select count(*) into v_n from public.feature_usage
   where install_id in ('eeeeeeee-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000004');
  if v_n <> 0 then raise exception 'an unknown label or school was stored'; end if;
end $$;

-- Reports ------------------------------------------------------------------------

do $$
declare v_r text; v_s text; v_n int;
begin
  set local role anon;
  v_r := public.submit_suggestion_v3('bug', 'school-v3', 'body', 'exams', null, '5.7.1', 'Safari', '17',
                                     '390x844', null, null, 'ios', 'iOS 18');
  if v_r is distinct from 'ok' then raise exception 'v3 answered %', v_r; end if;
  v_r := public.submit_suggestion_v4(p_type => 'idea', p_title => 'school-v4', p_body => 'body',
                                     p_screen => 'exams', p_school => 'vse', p_platform => 'android');
  if v_r is distinct from 'ok' then raise exception 'v4 answered %', v_r; end if;
  v_r := public.submit_suggestion_v4(p_type => 'idea', p_title => 'school-bad', p_body => 'body',
                                     p_screen => 'exams', p_school => 'muni');
  if v_r is distinct from 'rejected' then raise exception 'v4 with school muni answered %', v_r; end if;
  v_r := public.submit_suggestion_v4(p_type => 'idea', p_title => 'school-null', p_body => 'body',
                                     p_screen => 'exams', p_school => null);
  if v_r is distinct from 'rejected' then raise exception 'v4 with no school answered %', v_r; end if;
  reset role;
  select school into v_s from public.suggestions where title = 'school-v3';
  if v_s is distinct from 'mendelu' then raise exception 'v3 report school %', v_s; end if;
  select school into v_s from public.suggestions where title = 'school-v4';
  if v_s is distinct from 'vse' then raise exception 'v4 report school %', v_s; end if;
  select count(*) into v_n from public.suggestions where title in ('school-bad', 'school-null');
  if v_n <> 0 then raise exception 'a rejected report was stored'; end if;
end $$;

-- Stats count MENDELU only ----------------------------------------------------------
--
-- Another school's rows must change none of the figures. Inserted directly, with a
-- faculty, enough of them to clear the 5 and 10 floors, as regulars of the last
-- complete week and as eduroam setups: the state the faculty gate alone would let
-- through once another school's faculty is known.
create temp table stats_before as
select public.usage_stats_unchecked(30)::jsonb      as usage,
       public.usage_programmes_unchecked(30)::jsonb as programmes,
       public.usage_retention_unchecked()::jsonb    as retention,
       public.school_stats_unchecked()::jsonb       as school,
       public.feature_stats_unchecked(30)::jsonb    as features,
       public.get_usage_stats(30)                   as legacy_stats,
       public.get_unique_active_users(30)           as legacy_users;

do $$
declare
  v_today date := (now() at time zone 'Europe/Prague')::date;
  v_mon date := v_today - (extract(isodow from v_today)::int - 1) - 7;
  v_id text;
begin
  for i in 1..15 loop
    v_id := 'ffffffff-0000-0000-0000-' || lpad(i::text, 12, '0');
    insert into public.daily_active_usage (student_id, usage_date, faculty, platform, programme, app_version, school)
    values (v_id, v_mon,     'PEF', 'ios', 'B-OI', '5.8.0', 'czu'),
           (v_id, v_mon + 1, 'PEF', 'ios', 'B-OI', '5.8.0', 'czu'),
           (v_id, v_today,   'PEF', 'ios', 'B-OI', '5.8.0', 'czu');
    insert into public.feature_usage (install_id, usage_date, feature, school)
    values (v_id, v_today, 'eduroam_wifi_configured', 'czu'),
           (v_id, v_today, 'eduroam_profile_delivered', 'czu'),
           (v_id, v_today, 'map_dwell_3s', 'czu');
  end loop;
end $$;

do $$
declare b record;
begin
  select * into b from stats_before;
  if public.usage_stats_unchecked(30)::jsonb is distinct from b.usage then
    raise exception 'usage_stats counts another school';
  end if;
  if public.usage_programmes_unchecked(30)::jsonb is distinct from b.programmes then
    raise exception 'usage_programmes counts another school';
  end if;
  if public.usage_retention_unchecked()::jsonb is distinct from b.retention then
    raise exception 'usage_retention counts another school';
  end if;
  if public.school_stats_unchecked()::jsonb is distinct from b.school then
    raise exception 'school_stats counts another school';
  end if;
  if public.feature_stats_unchecked(30)::jsonb is distinct from b.features then
    raise exception 'feature_stats counts another school';
  end if;
  if public.get_usage_stats(30) is distinct from b.legacy_stats then
    raise exception 'get_usage_stats counts another school';
  end if;
  if public.get_unique_active_users(30) is distinct from b.legacy_users then
    raise exception 'get_unique_active_users counts another school';
  end if;
end $$;

rollback;
