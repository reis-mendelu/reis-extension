# Verifying `20261011120000_partner_targeting.sql`

Run 2026-10-09 on a throwaway `postgres:15` container (the migration history cannot be
replayed, see memory `verify-supabase-sql-locally`). Stubs: `anon`/`authenticated` roles, a
`get_my_role()` reading `test.role`, `societies` and `daily_active_usage` with their production
columns, and production's own `usage_suppress_groups` and 3-argument `track_daily_usage`
(read with `pg_get_functiondef` the same day). Then the migration, then the checks below.

| Claim | Result |
|---|---|
| A partner with `{pef:B-OI,frrms}` inserts | ok |
| Lower-case programme, empty array, partner without audience are rejected | `check_violation` ×3 |
| A mark path outside the row's own folder is rejected | `check_violation` |
| `ey` → partner `{pef}`; other rows stay `society` | ok |
| Exactly one `track_daily_usage` overload | 1 |
| 1-arg and 3-arg calls (released builds) still work | ok |
| `'b-oi'` stored as `B-OI`; a later null keeps it; garbage stored as null | ok |
| `usage_programmes_unchecked` excludes `web`, suppresses small groups to -1 | `PEF B-OI 13, PEF B-EM -1, PEF ? -1` |
| `usage_programmes` raises `forbidden` for non-admins, answers `reis_admin` | ok |
| anon may execute `track_daily_usage`, not the stats; nobody but definer runs `_unchecked` | t / f / f |
| `ARRAY[NULL]` and `{mendelu:B-OI}` are rejected (review, 2026-10-09) | `check_violation` ×2 |
| A device that moved PEF/B-OI → ZF (no programme) counts under `ZF ?`, not `ZF B-OI` | `ZF ?` |

## Stub setup (before the migration)

The `ey` and `esn` rows are seeded first, so check 6 proves the backfill
rather than passing on an empty table. Production's `usage_suppress_groups`
and 3-argument `track_daily_usage` are pasted in from `pg_get_functiondef`.

```sql
create role anon; create role authenticated;
create or replace function public.get_my_role() returns text language sql stable
  as $$ select current_setting('test.role', true) $$;
create table public.societies (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text not null, short_name text not null, color text not null,
  faculty_key text not null, auto_follow_faculty boolean not null default false,
  audience_label text,
  logo_path text check (logo_path is null or logo_path ~ ('^' || id || '/[0-9a-f]{32}\.png$')),
  sort_order int not null default 0, is_active boolean not null default true, instagram text);
insert into public.societies (id,name,short_name,color,faculty_key,sort_order)
  values ('ey','EY','EY','#2E2E38','pef',70), ('esn','ESN','ESN','#00AEEF','mendelu',10);
create table public.daily_active_usage (
  student_id text not null, usage_date date not null, open_count int not null default 1,
  faculty text, platform text, primary key (student_id, usage_date));
-- + production's usage_suppress_groups(jsonb) and track_daily_usage(text,text,text)
```

## Checks run

```sql
\pset format unaligned
\echo '1 valid partner insert'
insert into public.societies (id,name,short_name,color,faculty_key,kind,audience) values ('t1','T','T','#000000','pef','partner','{pef:B-OI,frrms}');
\echo '2 lowercase programme must fail'
do $$ begin insert into public.societies (id,name,short_name,color,faculty_key,kind,audience) values ('t2','T','T','#000000','pef','partner','{pef:b-oi}'); raise exception 'NOT REJECTED'; exception when check_violation then raise notice 'rejected ok'; end $$;
\echo '3 partner without audience must fail'
do $$ begin insert into public.societies (id,name,short_name,color,faculty_key,kind) values ('t3','T','T','#000000','pef','partner'); raise exception 'NOT REJECTED'; exception when check_violation then raise notice 'rejected ok'; end $$;
\echo '4 empty audience array must fail'
do $$ begin insert into public.societies (id,name,short_name,color,faculty_key,kind,audience) values ('t4','T','T','#000000','pef','partner','{}'); raise exception 'NOT REJECTED'; exception when check_violation then raise notice 'rejected ok'; end $$;
\echo '5 bad mark path must fail'
do $$ begin update public.societies set mark_light_path='other/0123456789abcdef0123456789abcdef.png' where id='t1'; raise exception 'NOT REJECTED'; exception when check_violation then raise notice 'rejected ok'; end $$;
update public.societies set mark_light_path='t1/0123456789abcdef0123456789abcdef.png' where id='t1';
\echo '6 ey backfill / esn untouched'
select id, kind, audience from public.societies where id in ('ey','esn') order by id;
\echo '7 one track_daily_usage'
select count(*) from pg_proc where proname='track_daily_usage';
\echo '8 calls'
select public.track_daily_usage('a');
select public.track_daily_usage('a', 'PEF', 'ios');
select public.track_daily_usage('a', 'PEF', 'ios', 'b-oi');
select public.track_daily_usage('a', 'PEF', 'ios', null);
select public.track_daily_usage('b', 'PEF', 'ios', 'garbage!');
select student_id, open_count, faculty, platform, programme from public.daily_active_usage order by 1;
\echo '9 stats with suppression'
insert into public.daily_active_usage (student_id, usage_date, faculty, platform, programme)
select 'oi'||g, (now() at time zone 'Europe/Prague')::date, 'PEF','ios','B-OI' from generate_series(1,12) g;
insert into public.daily_active_usage (student_id, usage_date, faculty, platform, programme)
select 'em'||g, (now() at time zone 'Europe/Prague')::date, 'PEF','ios','B-EM' from generate_series(1,7) g;
insert into public.daily_active_usage (student_id, usage_date, faculty, platform) values ('web1',(now() at time zone 'Europe/Prague')::date,'PEF','web');
select public.usage_programmes_unchecked(30);
\echo '10 gate'
set test.role = 'student';
do $$ begin perform public.usage_programmes(30); raise exception 'NOT FORBIDDEN'; exception when raise_exception then if sqlerrm='forbidden' then raise notice 'forbidden ok'; else raise; end if; end $$;
set test.role = 'reis_admin';
select public.usage_programmes(30) is not null as admin_ok;
\echo '11 grants'
select has_function_privilege('anon','public.track_daily_usage(text,text,text,text)','execute') as anon_track,
       has_function_privilege('anon','public.usage_programmes(int)','execute') as anon_stats,
       has_function_privilege('authenticated','public.usage_programmes_unchecked(int)','execute') as auth_unchecked;
\echo '12 NULL token and mendelu:programme must fail'
do $$ begin insert into public.societies (id,name,short_name,color,faculty_key,kind,audience) values ('t5','T','T','#000000','pef','partner',ARRAY[NULL]::text[]); raise exception 'NOT REJECTED'; exception when check_violation then raise notice 'rejected ok'; end $$;
do $$ begin insert into public.societies (id,name,short_name,color,faculty_key,kind,audience) values ('t6','T','T','#000000','pef','partner','{mendelu:B-OI}'); raise exception 'NOT REJECTED'; exception when check_violation then raise notice 'rejected ok'; end $$;
\echo '13 faculty change pairs labels from the same row'
insert into public.daily_active_usage (student_id, usage_date, faculty, platform, programme) values
 ('mv', (now() at time zone 'Europe/Prague')::date - 1, 'PEF', 'ios', 'B-OI'),
 ('mv', (now() at time zone 'Europe/Prague')::date, 'ZF', 'ios', null);
select key from json_to_recordset(public.usage_programmes_unchecked(30)) as x(key text, devices int) where key like 'ZF%';
```
