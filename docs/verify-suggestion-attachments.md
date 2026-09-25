# Verifying `20260925120000_suggestion_attachments.sql`

The migration history cannot be replayed (see `verify-supabase-sql-locally` in
the team notes), so this migration was checked on a throwaway container of the
**same image prod runs** — `supabase/postgres:17.6.1.063`, which ships pg_cron
preloaded — with only the objects it depends on.

## Recipe

```bash
docker run -d --name reis-attach-check -e POSTGRES_PASSWORD=pw -p 55441:5432 supabase/postgres:17.6.1.063
P='docker exec -i -e PGPASSWORD=pw reis-attach-check psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q'
# get_my_role() stub reading a session setting
echo "create or replace function public.get_my_role() returns text language sql stable as \$\$ select current_setting('test.role', true) \$\$;" | $P
$P < supabase/migrations/20260803120000_suggestions.sql
$P < supabase/migrations/20260903130000_submit_suggestion_rpc.sql
$P < supabase/migrations/20260925120000_suggestion_attachments.sql   # twice: idempotent
```

(Under zsh, put `$P` in a script — zsh does not word-split it.)

## Claims checked (2026-09-25)

| Claim | Result |
|---|---|
| Applies cleanly, and a second run leaves exactly one cron job | ✅ |
| Plain report → `ok`, no attachment row | ✅ |
| JPEG + diagnostics → `ok`, `has_screenshot`, `diagnostics_count = 1` | ✅ |
| PNG bytes → `ok_without_screenshot`, diagnostics kept | ✅ |
| Malformed base64 → `ok_without_screenshot`, report kept | ✅ |
| JPEG over 614 400 bytes → `ok_without_screenshot` | ✅ |
| Diagnostics that are not `{entries: [...]}` dropped, report `ok` | ✅ |
| Invalid report → `rejected` | ✅ |
| 32 screenshots in an hour → 30 `ok`, 2 `ok_without_screenshot` | ✅ |
| anon cannot select / insert / truncate the table, or run the prune or trigger functions | ✅ |
| `reis_admin` reads attachments; another role reads none | ✅ |
| Setting `status = 'done'` deletes that report's attachment | ✅ |
| Rows older than 90 days removed by `prune_suggestion_attachments()` | ✅ |
| Deleting a report cascades to its attachment | ✅ |

The behaviour script:

```sql
set role anon;
do $$
declare r text; n int; jpg text := encode('\xffd8ffe000104a46494600'::bytea, 'base64');
        diag jsonb := '{"entries":[{"t":1,"level":"error","source":"app","ctx":"Api.x","msg":"m"}],"env":{},"sync":{}}';
begin
  -- 1 plain report, no attachments -> ok, no attachment row
  r := public.submit_suggestion_v2('bug','T1','B','exams',null,'5','Chrome','131','1x1');
  assert r = 'ok', 'plain: ' || r;
  -- 2 screenshot + diagnostics -> ok
  r := public.submit_suggestion_v2('bug','T2','B','exams',null,'5','Chrome','131','1x1', diag, jpg);
  assert r = 'ok', 'both: ' || r;
  -- 3 not a JPEG -> ok_without_screenshot, diagnostics kept
  r := public.submit_suggestion_v2('bug','T3','B','exams',null,'5','Chrome','131','1x1', diag, encode('\x89504e47'::bytea,'base64'));
  assert r = 'ok_without_screenshot', 'png: ' || r;
  -- 4 malformed base64 -> ok_without_screenshot, no row at all (no diag)
  r := public.submit_suggestion_v2('bug','T4','B','exams',null,'5','Chrome','131','1x1', null, '!!!not base64');
  assert r = 'ok_without_screenshot', 'bad b64: ' || r;
  -- 5 oversize JPEG
  r := public.submit_suggestion_v2('bug','T5','B','exams',null,'5','Chrome','131','1x1', null,
        encode('\xffd8ff'::bytea || decode(repeat('00', 614400), 'hex'), 'base64'));
  assert r = 'ok_without_screenshot', 'big: ' || r;
  -- 6 malformed diagnostics dropped, report kept
  r := public.submit_suggestion_v2('bug','T6','B','exams',null,'5','Chrome','131','1x1', '[1,2]'::jsonb, null);
  assert r = 'ok', 'bad diag: ' || r;
  -- 7 invalid report -> rejected
  r := public.submit_suggestion_v2('nope','T7','B','exams');
  assert r = 'rejected', 'invalid: ' || r;
end $$;
-- anon cannot read or write the table directly
do $$ begin
  begin perform 1 from public.suggestion_attachments; raise exception 'anon could select';
  exception when insufficient_privilege then null; end;
  begin insert into public.suggestion_attachments (suggestion_id, diagnostics) values (1, '{}'); raise exception 'anon could insert';
  exception when insufficient_privilege then null; end;
  begin perform public.prune_suggestion_attachments(); raise exception 'anon could prune';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select s.title, a.has_screenshot, a.diagnostics_count, octet_length(a.screenshot) as bytes
  from public.suggestions s left join public.suggestion_attachments a on a.suggestion_id = s.id order by s.id;
-- admin read via RLS
set role authenticated;
select set_config('test.role', 'reis_admin', false);
select count(*) as admin_sees from public.suggestion_attachments;
select set_config('test.role', 'society', false);
select count(*) as society_sees from public.suggestion_attachments;
reset role;
-- done trigger
update public.suggestions set status = 'done' where title = 'T2';
select count(*) as t2_after_done from public.suggestion_attachments a join public.suggestions s on s.id=a.suggestion_id where s.title='T2';
-- 90-day prune
update public.suggestion_attachments set created_at = now() - interval '91 days';
select public.prune_suggestion_attachments();
select count(*) as after_prune from public.suggestion_attachments;
-- cascade
insert into public.suggestion_attachments (suggestion_id, diagnostics) select id, '{"entries":[]}' from public.suggestions where title='T1';
delete from public.suggestions where title='T1';
select count(*) as after_cascade from public.suggestion_attachments;
```

The screenshot budget and grant check:

```sql
set role anon;
do $$
declare r text; ok int := 0; lost int := 0; jpg text := encode('\xffd8ffe0'::bytea, 'base64');
begin
  for i in 1..32 loop
    r := public.submit_suggestion_v2('bug','B'||i,'B','exams',null,'5','Firefox','1'||i,'1x1', null, jpg);
    if r = 'ok' then ok := ok + 1; elsif r = 'ok_without_screenshot' then lost := lost + 1; end if;
  end loop;
  raise notice 'ok=% lost=%', ok, lost;
  assert ok = 30 and lost = 2, format('budget ok=%s lost=%s', ok, lost);
end $$;
reset role;
select has_function_privilege('anon', 'public.drop_attachments_when_done()', 'EXECUTE') as anon_trigger_fn,
       has_function_privilege('anon', 'public.prune_suggestion_attachments()', 'EXECUTE') as anon_prune,
       has_function_privilege('anon', 'public.submit_suggestion_v2(text,text,text,text,text,text,text,text,text,jsonb,text)', 'EXECUTE') as anon_v2,
       has_table_privilege('anon', 'public.suggestion_attachments', 'TRUNCATE') as anon_truncate;
```

## Applying

Migrations do not apply themselves. Run by hand, with `-f`:

```bash
npx supabase db query --linked -f supabase/migrations/20260925120000_suggestion_attachments.sql
```

It only adds objects, so it is safe before the client ships. Then smoke-test
through the public API with the shipped publishable key, and delete the smoke rows.
