begin;

-- old one-argument call still works (released clients)
do $$ begin
  set local role anon;
  perform public.track_daily_usage('11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

-- new call records faculty and platform
do $$
declare v_f text; v_p text; v_n int;
begin
  set local role anon;
  perform public.track_daily_usage('22222222-2222-2222-2222-222222222222', 'PEF', 'ios');
  perform public.track_daily_usage('22222222-2222-2222-2222-222222222222', 'PEF', 'ios');
  reset role;
  select faculty, platform, open_count into v_f, v_p, v_n from public.daily_active_usage
   where student_id = '22222222-2222-2222-2222-222222222222' and usage_date = current_date;
  if v_n is distinct from 2 then raise exception 'open_count not incremented: %', v_n; end if;
  if v_f is distinct from 'PEF' or v_p is distinct from 'ios' then raise exception 'dimensions not stored: % %', v_f, v_p; end if;
end $$;

-- an unknown platform is refused, the row is still counted
do $$
declare v_p text; v_n int;
begin
  set local role anon;
  perform public.track_daily_usage('33333333-3333-3333-3333-333333333333', null, 'toaster');
  reset role;
  select count(*), max(platform) into v_n, v_p from public.daily_active_usage
   where student_id = '33333333-3333-3333-3333-333333333333' and usage_date = current_date;
  if v_n <> 1 then raise exception 'row not counted: % rows', v_n; end if;
  if v_p is not null then raise exception 'invalid platform stored'; end if;
end $$;

-- an unknown faculty is refused, the row is still counted
do $$
declare v_f text; v_n int;
begin
  set local role anon;
  perform public.track_daily_usage('44444444-4444-4444-4444-444444444444', 'HOGWARTS', null);
  reset role;
  select count(*), max(faculty) into v_n, v_f from public.daily_active_usage
   where student_id = '44444444-4444-4444-4444-444444444444' and usage_date = current_date;
  if v_n <> 1 then raise exception 'row not counted: % rows', v_n; end if;
  if v_f is not null then raise exception 'invalid faculty stored'; end if;
end $$;

-- usage_stats refuses anyone who is not reis_admin
do $$ begin
  set local role authenticated;
  begin
    perform public.usage_stats(30);
    raise exception 'usage_stats answered a non-admin';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  reset role;
end $$;

-- usage_stats suppresses groups under five (runs as the connection's own role, which owns the function, so the role check inside usage_stats is bypassed by calling the unchecked helper directly)
do $$
declare v json; i int; ldf int; zf int; af int;
begin
  -- THREE groups, not two, and none of them on platform 'web'. Both details are
  -- load-bearing, and both were wrong here before — which is why this block
  -- asserted nothing for a full release cycle.
  --
  -- 1. `usage_stats_unchecked` drops `platform = 'web'` rows (it is the dev
  --    server, not an install). A 'web' fixture therefore never reaches
  --    by_faculty at all, so every lookup below returns NULL.
  -- 2. `usage_suppress_groups` hides more than the sub-threshold group, so a
  --    hidden count cannot be recovered by subtracting from the published
  --    total. With only LDF and AF seeded, AF was suppressed too, and the old
  --    `af >= 6` expectation could never have held. ZF is the third group that
  --    absorbs the extra suppression and leaves AF countable.
  --
  -- What this block does NOT prove: ZF has four devices, so plain `n < 5`
  -- suppresses it whether or not the anti-subtraction logic exists. The
  -- earlier blocks in this file also seed PEF and faculty-less rows, so the
  -- exact set of hidden groups here depends on fixture history. The cascade
  -- itself is therefore pinned separately, in the block below, against the
  -- pure function with literal input — where no fixture can shift the answer.
  for i in 1..3 loop
    perform public.track_daily_usage(gen_random_uuid()::text, 'LDF', 'ios');
  end loop;
  for i in 1..4 loop
    perform public.track_daily_usage(gen_random_uuid()::text, 'ZF', 'android');
  end loop;
  for i in 1..6 loop
    perform public.track_daily_usage(gen_random_uuid()::text, 'AF', 'extension');
  end loop;
  v := public.usage_stats_unchecked(30);

  -- Read each count ONCE into a variable and assert it is not null before
  -- comparing. When the field was renamed 'installs' -> 'devices',
  -- `e->>'installs'` began yielding NULL, and every comparison became
  -- `NULL <> -1` — which is NULL, not true, so no `raise` fired and the block
  -- passed while testing nothing. A test that cannot fail is worse than no
  -- test, because it reads as coverage. These guards are what make the next
  -- rename, or the next silent exclusion, LOUD.
  select (e->>'devices')::int into ldf
    from json_array_elements(v->'by_faculty') e where e->>'key' = 'LDF';
  select (e->>'devices')::int into zf
    from json_array_elements(v->'by_faculty') e where e->>'key' = 'ZF';
  select (e->>'devices')::int into af
    from json_array_elements(v->'by_faculty') e where e->>'key' = 'AF';

  if ldf is null or zf is null or af is null then
    raise exception 'by_faculty is missing a seeded group or its "devices" field (ldf=%, zf=%, af=%): %',
      ldf, zf, af, v;
  end if;

  if ldf <> -1 then raise exception 'small faculty group LDF not suppressed (got %)', ldf; end if;
  if zf <> -1 then raise exception 'sub-threshold group ZF not suppressed (got %)', zf; end if;
  if af <> 6 then raise exception 'large faculty group AF miscounted (expected 6, got %)', af; end if;
end $$;

-- The anti-subtraction cascade, pinned in isolation.
--
-- `usage_suppress_groups` is immutable and pure, so literal input tests it
-- exactly — no seeded rows, no platform filter, no dependence on what earlier
-- blocks in this transaction left behind. That matters: in the by_faculty
-- block above every suppressed group is ALSO under the `n < 5` threshold, so
-- those assertions would still pass if the cascade were deleted.
--
-- Here BIG is 9 — far above the threshold — and must STILL be suppressed,
-- because publishing it beside a total of 12 would reveal SMALL by subtraction.
-- Deleting the anti-subtraction logic makes BIG report 9 and fails this block,
-- which is the whole point of it.
do $$
declare got json; small int; big int; a int; b int;
begin
  got := public.usage_suppress_groups('[{"key":"SMALL","n":3},{"key":"BIG","n":9}]'::jsonb);
  select (e->>'devices')::int into small
    from json_array_elements(got) e where e->>'key' = 'SMALL';
  select (e->>'devices')::int into big
    from json_array_elements(got) e where e->>'key' = 'BIG';
  if small is null or big is null then
    raise exception 'usage_suppress_groups dropped a key or renamed "devices": %', got;
  end if;
  if small <> -1 then raise exception 'sub-threshold group was published (got %)', small; end if;
  if big <> -1 then
    raise exception 'anti-subtraction cascade gone: BIG (9, above the floor) was published as %, which reveals SMALL by subtraction', big;
  end if;

  -- Control: with nothing under the floor, nothing is hidden. Without this a
  -- function that suppressed EVERYTHING would satisfy the assertions above.
  got := public.usage_suppress_groups('[{"key":"A","n":7},{"key":"B","n":9}]'::jsonb);
  select (e->>'devices')::int into a from json_array_elements(got) e where e->>'key' = 'A';
  select (e->>'devices')::int into b from json_array_elements(got) e where e->>'key' = 'B';
  if a is distinct from 7 or b is distinct from 9 then
    raise exception 'groups above the floor must be published unchanged (a=%, b=%): %', a, b, got;
  end if;
end $$;

-- the unchecked helper is not reachable by untrusted roles
do $$ begin
  set local role anon;
  begin
    perform public.usage_stats_unchecked(30);
    raise exception 'anon could call usage_stats_unchecked';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role authenticated;
  begin
    perform public.usage_stats_unchecked(30);
    raise exception 'authenticated could call usage_stats_unchecked';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
