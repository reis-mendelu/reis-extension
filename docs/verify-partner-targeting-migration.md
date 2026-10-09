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
```
