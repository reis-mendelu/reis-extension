-- Run after the migrations; rolls back.
begin;

-- the seed is there and switched off
do $$
declare n int;
begin
  select count(*) into n from public.study_aids where id = 'mendelu-app' and not is_active;
  if n <> 1 then raise exception 'mendelu-app is not seeded as off (%)', n; end if;
end $$;

-- the programme Discord servers are seeded ON, each for its own PEF programme
-- (20261127120000), and a student reads them
do $$
declare n int;
begin
  select count(*) into n from public.study_aids
   where (id = 'discord-b-oi' and audience = array['pef:B-OI'] and is_active)
      or (id = 'discord-b-aii' and audience = array['pef:B-AII'] and is_active);
  if n <> 2 then raise exception 'the Discord links are not seeded on (%)', n; end if;
  set local role anon;
  select count(*) into n from public.study_aids where id in ('discord-b-oi', 'discord-b-aii');
  reset role;
  if n <> 2 then raise exception 'anon saw % of the 2 active Discord links', n; end if;
end $$;

-- a student sees nothing of a link while it is off (the other links are on)
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.study_aids where id = 'mendelu-app';
  reset role;
  if n <> 0 then raise exception 'anon saw % switched-off rows', n; end if;
end $$;

-- ...and the row once it is on
update public.study_aids set is_active = true where id = 'mendelu-app';
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.study_aids where id = 'mendelu-app';
  reset role;
  if n <> 1 then raise exception 'anon saw % rows of an active link', n; end if;
end $$;

-- a student cannot add, change or remove a link
do $$
begin
  set local role anon;
  insert into public.study_aids (id, audience) values ('x', array['af']);
  raise exception 'anon inserted a link';
exception when insufficient_privilege then reset role;
end $$;
do $$
begin
  set local role anon;
  update public.study_aids set audience = array['mendelu'] where id = 'mendelu-app';
  raise exception 'anon changed an audience';
exception when insufficient_privilege then reset role;
end $$;
do $$
begin
  set local role anon;
  delete from public.study_aids where id = 'mendelu-app';
  raise exception 'anon deleted a link';
exception when insufficient_privilege then reset role;
end $$;

-- the audience follows the partner rule: a faculty, a programme of one, or the
-- whole university; nothing else, and never empty
do $$
begin
  update public.study_aids set audience = array['af:not a code'] where id = 'mendelu-app';
  raise exception 'a malformed token was accepted';
exception when check_violation then null;
end $$;
do $$
begin
  update public.study_aids set audience = array[]::text[] where id = 'mendelu-app';
  raise exception 'an empty audience was accepted';
exception when check_violation then null;
end $$;
do $$
begin
  update public.study_aids set audience = null where id = 'mendelu-app';
  raise exception 'a null audience was accepted';
exception when not_null_violation then null;
end $$;

-- the console. The reads and writes above ran as anon or as the test owner (who
-- bypasses the row rules), so these check the policies themselves, as signed-in
-- accounts: a reis_admin reads a switched-off link and changes it; a society
-- account sees nothing of it and cannot change it. get_my_role() resolves who.
insert into public.societies (id, name, short_name, color, faculty_key) values
  ('reis', 'reIS', 'reIS', '#000000', 'mendelu'), ('esn', 'ESN', 'ESN', '#000000', 'mendelu')
on conflict (id) do nothing;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'admin@test'),
  ('00000000-0000-0000-0000-00000000e501', 'esn@test');
insert into public.spolky_accounts (email, association_id, association_name, role, user_id) values
  ('admin@test', 'reis', 'reIS', 'reis_admin', '00000000-0000-0000-0000-00000000ad01'),
  ('esn@test', 'esn', 'ESN', 'association', '00000000-0000-0000-0000-00000000e501');
update public.study_aids set is_active = false where id = 'mendelu-app';

do $$
declare n int; aud text[]; active boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.study_aids where id = 'mendelu-app' and not is_active;
  update public.study_aids set audience = array['af:N-TZO'], is_active = true
   where id = 'mendelu-app';
  reset role;
  if n <> 1 then raise exception 'a reis_admin cannot read a switched-off link (%)', n; end if;
  select audience, is_active into aud, active from public.study_aids where id = 'mendelu-app';
  if aud is distinct from array['af:N-TZO'] or active is not true then
    raise exception 'the reis_admin update did not land (%, %)', aud, active;
  end if;
end $$;

-- even a reis_admin cannot add or remove a link through the API: a link exists
-- because a migration seeded it and the client knows its id
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.study_aids (id, audience) values ('x', array['af']);
  raise exception 'a reis_admin inserted a link';
exception when insufficient_privilege then reset role;
end $$;
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
  set local role authenticated;
  delete from public.study_aids where id = 'mendelu-app';
  raise exception 'a reis_admin deleted a link';
exception when insufficient_privilege then reset role;
end $$;

-- a society account: switched off, the link is invisible to it, and an update
-- finds no row (RLS hides it, so it reports 0 rows and changes nothing)
update public.study_aids set is_active = false where id = 'mendelu-app';
do $$
declare n int; changed int; active boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000e501","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.study_aids where id = 'mendelu-app';
  update public.study_aids set is_active = true, audience = array['mendelu'] where id = 'mendelu-app';
  get diagnostics changed = row_count;
  reset role;
  if n <> 0 then raise exception 'a society saw % switched-off links', n; end if;
  if changed <> 0 then raise exception 'a society updated % links', changed; end if;
  select is_active into active from public.study_aids where id = 'mendelu-app';
  if active is not false then raise exception 'a society switched a link on'; end if;
end $$;

-- and switched on, a society sees it like any student, but still cannot change it
update public.study_aids set is_active = true where id = 'mendelu-app';
do $$
declare n int; changed int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000e501","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.study_aids where id = 'mendelu-app';
  update public.study_aids set audience = array['mendelu'] where id = 'mendelu-app';
  get diagnostics changed = row_count;
  reset role;
  if n <> 1 then raise exception 'a society saw % active links, want 1', n; end if;
  if changed <> 0 then raise exception 'a society changed an audience'; end if;
end $$;

rollback;
