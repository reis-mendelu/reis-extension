-- Run after the migrations; rolls back.
begin;

insert into public.critical_app_version (min_version, reason_cz, reason_en)
values ('5.7.0', 'IS změnil vzhled.', 'IS changed its look.');

-- a student reads it
do $$
declare v text;
begin
  set local role anon;
  select min_version into v from public.critical_app_version;
  reset role;
  if v is distinct from '5.7.0' then raise exception 'anon read %', v; end if;
end $$;

-- there is only ever one row
do $$
begin
  insert into public.critical_app_version (id, min_version, reason_cz, reason_en)
  values (2, '5.8.0', 'x', 'x');
  raise exception 'a second row was accepted';
exception when check_violation then null;
end $$;

-- a malformed version is refused
do $$
begin
  update public.critical_app_version set min_version = '5.7';
  raise exception 'a malformed version was accepted';
exception when check_violation then null;
end $$;

-- neither a student nor a signed-in account can set, change or clear it
do $$
begin
  set local role anon;
  delete from public.critical_app_version;
  raise exception 'anon cleared the critical version';
exception when insufficient_privilege then reset role;
end $$;
do $$
begin
  set local role authenticated;
  update public.critical_app_version set min_version = '9.9.9';
  raise exception 'authenticated changed the critical version';
exception when insufficient_privilege then reset role;
end $$;
do $$
begin
  set local role authenticated;
  insert into public.critical_app_version (min_version, reason_cz, reason_en) values ('9.9.9', 'x', 'x')
    on conflict (id) do nothing;
  raise exception 'authenticated set the critical version';
exception when insufficient_privilege then reset role;
end $$;
do $$
begin
  if (select min_version from public.critical_app_version) <> '5.7.0' then
    raise exception 'the critical version changed';
  end if;
end $$;

rollback;
