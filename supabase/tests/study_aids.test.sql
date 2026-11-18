-- Run after the migrations; rolls back.
begin;

-- the seed is there and switched off
do $$
declare n int;
begin
  select count(*) into n from public.study_aids where id = 'mendelu-app' and not is_active;
  if n <> 1 then raise exception 'mendelu-app is not seeded as off (%)', n; end if;
end $$;

-- a student sees nothing while it is off
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.study_aids;
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

rollback;
