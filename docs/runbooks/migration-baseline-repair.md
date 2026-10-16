# Pointing prod's migration history at the baseline

`supabase/migrations/20261016000000_baseline.sql` is prod's schema as it stood on
2026-10-16. Prod's own ledger (`supabase_migrations.schema_migrations`) still
lists 29 of the old files, the last `20260907130000`, and not the baseline.
These commands make the ledger say what is true: the baseline is applied, the
archived files are not tracked. They write **only** to that ledger table. No
schema, grant or row of app data changes.

Dominik runs this, once, after the baseline PR merges into `test`. A session
never does.

## 0. Before: confirm prod still equals the baseline

If prod changed since the PR's proof (someone ran SQL by hand), the baseline
would be marked applied while not matching. Re-run the proof first:

```bash
npx supabase db diff --linked -s public
```

Expect `No schema changes found`. Then the catalog check (grants, policies,
buckets, cron), from a running local stack (`npx supabase start`):

```bash
npm run db:fingerprint
```

Expect `SAME: 359 lines, prod = local`. It fails closed: a CLI error or an empty
result prints `FAILED` and exits non-zero rather than comparing. Anything but
`SAME`: stop, the baseline needs regenerating first.

And the ledger as it is now (29 rows, the last `20260907130000`):

```bash
npx supabase db query --linked "select count(*), max(version) from supabase_migrations.schema_migrations"
```

## 1. Repair

Forget the 29 archived versions:

```bash
npx supabase migration repair --linked --status reverted 20260226090000 20260228120000 20260505120000 20260506120000 20260520120000 20260524120000 20260616120000 20260617120000 20260705120000 20260705120100 20260705120200 20260705120300 20260705120400 20260705120500 20260717120000 20260803120000 20260803120100 20260829120000 20260829120100 20260830120000 20260831120000 20260903120000 20260903130000 20260903140000 20260904120000 20260904130000 20260904140000 20260907120000 20260907130000
```

Record the baseline as applied (this does not run it):

```bash
npx supabase migration repair --linked --status applied 20261016000000
```

**Any migration newer than the baseline that prod already has** — e.g. #556's
`20261016120000_support_prompt_signals.sql` if it was applied by hand with
`db query -f` before this repair — gets recorded the same way, one command per
file, or a later automatic apply would run it a second time:

```bash
npx supabase migration repair --linked --status applied 20261016120000
```

Skip that last command if the file is not applied in prod yet (then it is simply
pending, which is correct). Step 0's `db diff` tells you which: run it on a
checkout that contains the file; no changes means prod has it.

The same holds afterwards, until CI applies migrations itself: a migration
applied by hand also needs `migration repair --linked --status applied <its
version>`, or the ledger drifts from prod again.

## 2. After: verify

The baseline, plus any later version you recorded above, and nothing older:

```bash
npx supabase db query --linked "select version, name from supabase_migrations.schema_migrations order by version"
```

Local and remote agree: every row has the same version on both sides (a file
not yet applied in prod shows local only, which is correct):

```bash
npx supabase migration list --linked
```

And repeat step 0's `db diff` and `npm run db:fingerprint`: no changes, `SAME`.

## What it was rehearsed on

The same two `repair` commands were run with `--local` against a local stack
built from the baseline, after seeding its ledger with the 29 old versions. The
ledger ended with the one baseline row and the fingerprint was unchanged. The
PR that added this file has the output.

If a migration was opened before the baseline merged, give it a timestamp newer
than `20261016000000` (or keep a newer one it already has). An older file would
sort before the baseline, and `db push` refuses migrations older than the last
applied one.
