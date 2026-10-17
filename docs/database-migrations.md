# Database migrations

`supabase/migrations/` starts with `20261016000000_baseline.sql`, prod's schema
on 2026-10-16; `npx supabase start` builds the whole database locally. The older
files in `supabase/migrations_archive/` are history only: never apply them.

**A release applies migrations; nobody applies one by hand.** Merging the
release PR runs `supabase db push` against prod (`db-migrate.yml`, called by
`ship.yml`) before the three stores, which wait for it.

Writing one:

- A new file on top, with a timestamp newer than the newest one there.
- **Additive only.** Old builds stay installed for weeks and run against the new
  schema, so add columns, tables and functions; don't drop, rename or tighten
  what a released build uses. Removing something takes two releases.
- No `begin;`/`commit;` in the file: the CLI already runs each file in one
  transaction, and a COMMIT inside it can leave a failed file half-applied.
- Nothing is changed in prod by hand: no dashboard edits, no `db query --linked -f`.

If a release's migration fails, it is rolled back, nothing is recorded and no
store is submitted. The next release would try the same file first, so fix
**that file** (it never ran, so editing it is safe) and release again.
