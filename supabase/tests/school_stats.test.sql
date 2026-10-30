begin;

-- school_stats refuses anyone who is not reis_admin
do $$ begin
  set local role authenticated;
  begin
    perform public.school_stats();
    raise exception 'school_stats answered a non-admin';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  reset role;
end $$;

-- the unchecked helper and the suppression helper are not reachable by untrusted roles
do $$ begin
  set local role anon;
  begin
    perform public.school_stats();
    raise exception 'anon could call school_stats';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.school_stats_unchecked();
    raise exception 'anon could call school_stats_unchecked';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role authenticated;
  begin
    perform public.school_stats_unchecked();
    raise exception 'authenticated could call school_stats_unchecked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.school_suppress_groups('[]'::jsonb);
    raise exception 'authenticated could call school_suppress_groups';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- the floor is 10, and the next group up is hidden too so the first cannot be
-- recovered by subtraction
do $$
declare got json; a int; b int; c int;
begin
  got := public.school_suppress_groups('[{"key":"A","n":7},{"key":"B","n":12},{"key":"C","n":40}]'::jsonb);
  select (e->>'n')::int into a from json_array_elements(got) e where e->>'key' = 'A';
  select (e->>'n')::int into b from json_array_elements(got) e where e->>'key' = 'B';
  select (e->>'n')::int into c from json_array_elements(got) e where e->>'key' = 'C';
  if a is distinct from -1 or b is distinct from -1 or c is distinct from 40 then
    raise exception 'expected A and B hidden, C published (a=%, b=%, c=%): %', a, b, c, got;
  end if;

  got := public.school_suppress_groups('[{"key":"A","n":4},{"key":"B","n":5}]'::jsonb);
  if json_array_length(got) <> 0 then
    raise exception 'a breakdown of a population under 10 must be empty: %', got;
  end if;
end $$;

-- regulars count installs seen on 2+ days of the last complete week; web never counts
do $$
declare
  v json; i int; wk_from date; id text; pef int; total int; phones int; edu int;
begin
  wk_from := (now() at time zone 'Europe/Prague')::date
             - (extract(isodow from (now() at time zone 'Europe/Prague')::date)::int - 1) - 7;

  -- 12 PEF phones on two days of last week: regulars
  for i in 1..12 loop
    id := 'pef-regular-' || i;
    insert into public.daily_active_usage (student_id, usage_date, faculty, platform)
    values (id, wk_from, 'PEF', 'ios'), (id, wk_from + 2, 'PEF', 'ios');
    insert into public.feature_usage (install_id, usage_date, feature)
    values (id, wk_from, 'eduroam_wifi_configured');
  end loop;
  -- 15 AF laptops on ONE day only: not regulars
  for i in 1..15 loop
    insert into public.daily_active_usage (student_id, usage_date, faculty, platform)
    values ('af-once-' || i, wk_from + 1, 'AF', 'extension');
  end loop;
  -- 11 phones on two days that IS never named a student on: not counted
  for i in 1..11 loop
    id := 'unlabelled-' || i;
    insert into public.daily_active_usage (student_id, usage_date, faculty, platform)
    values (id, wk_from, null, 'android'), (id, wk_from + 2, null, 'android');
  end loop;
  -- 20 'web' rows on two days: the dev server, never counted
  for i in 1..20 loop
    id := 'web-' || i;
    insert into public.daily_active_usage (student_id, usage_date, faculty, platform)
    values (id, wk_from, 'PEF', 'web'), (id, wk_from + 3, 'PEF', 'web');
  end loop;

  v := public.school_stats_unchecked();

  total := (v->>'regulars')::int;
  phones := (v->>'regulars_phone')::int;
  select (e->>'n')::int into pef from json_array_elements(v->'regulars_by_faculty') e where e->>'key' = 'PEF';
  if total is null or phones is null or pef is null then
    raise exception 'a field went missing: %', v;
  end if;
  if total <> 12 or phones <> 12 or pef <> 12 then
    raise exception 'expected 12 regulars, 12 phones, PEF 12 (got %, %, %)', total, phones, pef;
  end if;

  select (e->>'n')::int into edu from json_array_elements(v->'eduroam_by_faculty') e where e->>'key' = 'PEF';
  if edu is distinct from 12 or (v->>'eduroam_wifi')::int is distinct from 12 then
    raise exception 'expected 12 PEF eduroam setups: %', v;
  end if;
  if (v->>'eduroam_total')::int is distinct from 12 then
    raise exception 'expected an eduroam total of 12: %', v->>'eduroam_total';
  end if;
  if (v->>'eduroam_profile')::int is distinct from -1 then
    raise exception 'zero laptop profiles must read as hidden (-1): %', v->>'eduroam_profile';
  end if;
end $$;

rollback;
