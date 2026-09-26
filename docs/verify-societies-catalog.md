# Verifying the societies catalog migration

`supabase/migrations/20260926120000_societies_catalog.sql` was checked on a stub
Postgres 15, because this project's migration history cannot be replayed from
scratch (see the header of `20260907130000_usage_dimensions.sql`), and prod is
not a test rig.

**The migration is not applied by this check.** Applying it is a hand step,
owned by `docs/runbooks/societies-catalog-rollout.md`.

## Recipe

```bash
docker run -d --name reis-societies-sql -e POSTGRES_PASSWORD=pw -p 55434:5432 postgres:15
docker exec -i reis-societies-sql psql -U postgres -v ON_ERROR_STOP=1 < prereq.sql
docker exec -i reis-societies-sql psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260926120000_societies_catalog.sql
docker exec -i reis-societies-sql psql -U postgres < claims.sql   # last line: ALL CLAIMS HOLD
docker rm -f reis-societies-sql
```

`prereq.sql` creates only what the migration touches:
- the `anon` and `authenticated` roles
- a `storage` schema with `buckets` and `objects`
- `spolky_accounts` holding the eight prod ids
- a `get_my_role()` stub that reads the session setting `test.role`, so each check can choose a role

`claims.sql` runs one `DO` block per claim below. Each raises `FAIL:` if its claim breaks. Both files are reproduced in full in Task 1 of `docs/superpowers/plans/2026-09-26-societies-in-supabase.md`.

The role claim is set with `set_config(..., false)`, which lasts for the session. The transaction-local form (`true`) would be gone by the next psql statement.

## Claims (2026-09-26, all held)

| # | Claim | Result |
| --- | --- | --- |
| 1 | `anon` reads all eight seeded rows | held |
| 2 | `anon` cannot insert | held (`insufficient_privilege`) |
| 3 | a society account (`association`) can neither insert nor update | held (insert rejected, update touches 0 rows) |
| 4 | `reis_admin` can insert and update | held |
| 5 | `id` cannot change | held (trigger) |
| 6 | only one auto-follow society per faculty | held (`unique_violation`) |
| 7 | `logo_path` must sit under the row's own id | held (`check_violation`) |
| 8 | an account for a missing society is rejected | held (`foreign_key_violation`) |
| 9 | storage: an association cannot upload a logo; `reis_admin` can upload and delete | held |
| 10 | `anon` has no `TRUNCATE` on `societies` | held |

## Dry-run wrapper (proves the runbook's step 2)

The whole migration can be wrapped in a single self-unwinding `DO` block:

```bash
{ echo 'do $dry$ begin';
  sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20260926120000_societies_catalog.sql;
  echo "raise exception 'DRY RUN OK >> societies=% fk=% logo_policies=%', (select count(*) from public.societies), (select count(*) from pg_constraint where conname = 'spolky_accounts_association_id_fkey'), (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'society_logos_%');";
  echo 'end $dry$;'; } > dryrun.sql
```

On the stub it printed `ERROR:  DRY RUN OK >> societies=8 fk=1 logo_policies=4`. Afterwards `to_regclass('public.societies')` was null and `storage.buckets` was empty, so everything was unwound.

The first attempt failed because the migration's own header comment contained the wrapper's tag, which ended the wrapper early. The comment now says never to write that tag in the file.

## What this does not prove

- That the production CLI role may `create policy` on `storage.objects`. Only the dry-run against prod shows that.
- That supabase-js's upload call succeeds under these policies against real Storage. Proving that needs `REIS_ADMIN_EMAIL` / `REIS_ADMIN_PASSWORD`.
