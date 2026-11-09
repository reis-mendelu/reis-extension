-- Run after the migrations; rolls back.
begin;

insert into public.is_notice_mutes (notice_key, title) values ('zasadka:1', 'Test');

-- a student reads the list
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.is_notice_mutes where notice_key = 'zasadka:1';
  reset role;
  if n <> 1 then raise exception 'anon saw % mutes', n; end if;
end $$;

-- a student cannot mute or un-mute
do $$
begin
  set local role anon;
  insert into public.is_notice_mutes (notice_key, title) values ('zasadka:2', 'x');
  raise exception 'anon muted a notice';
exception when insufficient_privilege then reset role;
end $$;
do $$
declare n int;
begin
  set local role anon;
  delete from public.is_notice_mutes where notice_key = 'zasadka:1';
  reset role;
  select count(*) into n from public.is_notice_mutes where notice_key = 'zasadka:1';
  if n <> 1 then raise exception 'anon un-muted a notice'; end if;
exception when insufficient_privilege then reset role;
end $$;

-- a reis_admin mutes (twice: the console's upsert) and un-mutes; a society cannot
insert into public.societies (id, name, short_name, color, faculty_key) values
  ('reis', 'reIS', 'reIS', '#000000', 'mendelu'), ('esn', 'ESN', 'ESN', '#000000', 'mendelu')
on conflict (id) do nothing;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'admin@test'),
  ('00000000-0000-0000-0000-00000000e501', 'esn@test');
insert into public.spolky_accounts (email, association_id, association_name, role, user_id) values
  ('admin@test', 'reis', 'reIS', 'reis_admin', '00000000-0000-0000-0000-00000000ad01'),
  ('esn@test', 'esn', 'ESN', 'association', '00000000-0000-0000-0000-00000000e501');

do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.is_notice_mutes (notice_key, title) values ('zasadka:3', 'x')
    on conflict (notice_key) do update set title = excluded.title;
  insert into public.is_notice_mutes (notice_key, title) values ('zasadka:3', 'y')
    on conflict (notice_key) do update set title = excluded.title;
  delete from public.is_notice_mutes where notice_key = 'zasadka:1';
  reset role;
  select count(*) into n from public.is_notice_mutes where notice_key in ('zasadka:1', 'zasadka:3');
  if n <> 1 then raise exception 'admin mute/un-mute left % rows, want 1', n; end if;
  if (select title from public.is_notice_mutes where notice_key = 'zasadka:3') <> 'y' then
    raise exception 'upsert kept the old title';
  end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000e501","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.is_notice_mutes (notice_key, title) values ('zasadka:4', 'x');
  raise exception 'a society muted a notice';
exception when insufficient_privilege then reset role;
end $$;

rollback;
