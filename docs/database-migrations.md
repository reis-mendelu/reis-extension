# Database migrations

`supabase/migrations/` starts with `20261016000000_baseline.sql`, prod's schema
dumped on 2026-10-16, so `npx supabase start` / `npx supabase db reset` build the
whole database locally. The history before it is in `supabase/migrations_archive/`:
read it for the reasoning, never apply it.

**Migrations apply themselves; nobody applies one by hand.**

| When | What | Where |
| --- | --- | --- |
| Every PR touching `supabase/` or `scripts/db/` | `npm run db:lint` (expand/contract), a throwaway database built from the branch's migrations, `supabase/tests` against it | the required "Unit tests" job, `ci.yml` |
| Release (`test` → `main`) | `supabase db push` to prod, before the three stores, which wait for it | `db-migrate.yml`, called by `ship.yml` |
| Nightly | rebuilds what prod's ledger says it has; compares schema and grants/policies/buckets/cron | `db-drift.yml`, `npm run db:drift` |

## Writing one

- A new file on top, timestamp newer than the newest there. Never edit, rename or
  delete a merged one: it may already be in prod.
- **Additive only.** An old build stays installed for weeks and runs against the
  new schema. The linter (`scripts/db/migrationLint.mjs`) flags drops, renames,
  type changes, new NOT NULL/CHECK constraints, revokes from `anon`/`authenticated`,
  row changes and DO blocks. A flagged statement needs a comment in the file:
  `-- migration-lint: allow <rule>: <why every released build survives it>`.
  Removing something takes two releases: stop using it, then drop it.
- No `begin;`/`commit;`. The CLI runs each file in one transaction, and a COMMIT
  inside it leaves a failed file half-applied (shown on CLI 2.121.0).
- The CI database is empty. A constraint that prod's existing rows violate passes
  CI and fails at release; check prod's rows read-only before adding one.
- Nothing is changed in prod by hand: no dashboard edits, no `db query --linked -f`,
  no `db push` or `migration repair --linked` from a session.

## When a release's migration fails

The database job goes red, the stores are not submitted, and prod is unchanged
by that file: the CLI rolled it back and did not record it. Files before it in
the same push did apply and are recorded.

The failed file is still pending, so the next release tries it **first** and
stops on it again. A new migration after it never runs. Fix the failed file
itself:

1. Confirm it never applied: `npm run db:drift` lists it under `pending`, or
   `npx supabase migration list --linked` shows it local-only.
2. Edit it in a PR, with this line in the file (the linter refuses an edited
   migration otherwise):
   `-- migration-lint: allow edit-unapplied: <the release that failed, and the db:drift line>`
3. Release again (a patch version is fine). The database job applies the fixed
   file, then the stores go out.

This is only for a file that never applied. A migration that succeeded is in
prod: change it with a new file.

## Local stacks

`project_id` is `reis-extension` in every worktree, so `npx supabase start` is
one stack per machine: check `docker ps` before starting or stopping one. The
drift check builds its own (`reis-drift`, ports 563xx) and removes it afterwards.

`npm run db:fingerprint` compares prod with the running local stack: grants,
policies, buckets and the cron job, which `supabase db diff` does not see.
