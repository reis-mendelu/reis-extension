\set ON_ERROR_STOP 1
-- 1. anon reads all eight rows
set role anon;
do $$ begin if (select count(*) from public.societies) <> 8 then raise exception 'FAIL: anon read'; end if; end $$;
-- 2. anon cannot insert
do $$ begin
  insert into public.societies (id,name,short_name,color,faculty_key) values ('x','X','X','#000000','pef');
  raise exception 'FAIL: anon insert allowed';
exception when insufficient_privilege then null; end $$;
reset role;
-- 3. a society account cannot insert or update
select set_config('test.role', 'association', false);
set role authenticated;
do $$ begin
  insert into public.societies (id,name,short_name,color,faculty_key) values ('x','X','X','#000000','pef');
  raise exception 'FAIL: association insert allowed';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  update public.societies set name = 'Hacked' where id = 'esn';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: association update touched % rows', n; end if;
end $$;
reset role;
-- 4. reis_admin can insert and update
select set_config('test.role', 'reis_admin', false);
set role authenticated;
insert into public.societies (id,name,short_name,color,faculty_key) values ('newsoc','New','NEW','#123456','zf');
update public.societies set name = 'Newer' where id = 'newsoc';
-- 5. the id cannot change
do $$ begin
  update public.societies set id = 'renamed' where id = 'newsoc';
  raise exception 'FAIL: id changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
-- 6. only one auto-follow society per faculty
do $$ begin
  update public.societies set auto_follow_faculty = true where id = 'ey';
  raise exception 'FAIL: second PEF auto-follow allowed';
exception when unique_violation then null; end $$;
-- 7. a logo_path must sit under its own id
do $$ begin
  update public.societies set logo_path = 'esn/0123456789abcdef0123456789abcdef.png' where id = 'newsoc';
  raise exception 'FAIL: foreign logo path allowed';
exception when check_violation then null; end $$;
update public.societies set logo_path = 'newsoc/0123456789abcdef0123456789abcdef.png' where id = 'newsoc';
reset role;
-- 8. the FK rejects an account for a missing society
do $$ begin
  insert into public.spolky_accounts values ('ghost','association',gen_random_uuid());
  raise exception 'FAIL: orphan account allowed';
exception when foreign_key_violation then null; end $$;
-- 9. storage: association cannot write logos, reis_admin can
select set_config('test.role', 'association', false);
set role authenticated;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('society-logos', 'esn/a.png');
  raise exception 'FAIL: association logo upload allowed';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('test.role', 'reis_admin', false);
set role authenticated;
insert into storage.objects (bucket_id, name) values ('society-logos', 'esn/a.png');
delete from storage.objects where name = 'esn/a.png';
reset role;
-- 10. anon has no TRUNCATE
do $$ begin
  if has_table_privilege('anon', 'public.societies', 'TRUNCATE') then raise exception 'FAIL: anon truncate'; end if;
end $$;
select 'ALL CLAIMS HOLD';
