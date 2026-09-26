# Rolling out the societies catalog

The steps that change production when the societies-in-Supabase PR ships. **No
CI applies migrations** and nothing here runs by itself. Each step is a
deliberate hand action, and steps 2–5 are Dominik's call.

Spec: `docs/superpowers/specs/2026-09-26-societies-in-supabase-design.md`.
Local SQL evidence: `docs/verify-societies-catalog.md`.

## Before you start

- The CLI is linked to the prod project (`zvbpgkmnrqyprtkyxkwn`). Use `npx supabase`. **Never `db push`.**
- `$SCRATCH` is any scratch directory.
- Prechecked 2026-09-26: `public.societies` does not exist, `spolky_accounts.association_id` is `text`, and prod holds exactly the eight society ids the migration seeds.

## 1. Merge the PR into `test`

Merging applies nothing. The new client also runs against an unmigrated
database: the catalog fetch fails and the app keeps its bundled seed. That
seed has no logos, so logo slots show the colour tiles until step 5.

## 2. Dry-run the migration against prod

Wraps the whole migration in one `DO` block that raises at the end, so
everything it did unwinds. The migration has no early `return`, so the raise is
always reached. Re-check that if the migration ever changes.

```bash
{ echo 'do $dry$ begin';
  sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20260926120000_societies_catalog.sql;
  echo "raise exception 'DRY RUN OK >> societies=% fk=% logo_policies=%', (select count(*) from public.societies), (select count(*) from pg_constraint where conname = 'spolky_accounts_association_id_fkey'), (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'society_logos_%');";
  echo 'end $dry$;'; } > "$SCRATCH/societies-dryrun.sql"
npx supabase db query --linked -f "$SCRATCH/societies-dryrun.sql"
npx supabase db query --linked "select to_regclass('public.societies')::text as t"
```

Expect the first command to fail with `DRY RUN OK >> societies=8 fk=1 logo_policies=4`, and the second to return `"t": null`.

This is the only step that proves the CLI's prod role may `create policy on storage.objects`. The local stub cannot show that.

## 3. Apply

```bash
npx supabase db query --linked -f supabase/migrations/20260926120000_societies_catalog.sql
```

## 4. Verify through the public API, as the app does

Use the shipped publishable key (`src/services/supabase/config.ts`), not the superuser the CLI connects as:

```bash
URL=https://zvbpgkmnrqyprtkyxkwn.supabase.co
KEY=sb_publishable_QqCe7QTJ6yhYSpRTdBJFSg_Qnt8nBf0
curl -s "$URL/rest/v1/societies?select=id&order=sort_order" -H "apikey: $KEY"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/rest/v1/societies" \
  -H "apikey: $KEY" -H 'Content-Type: application/json' \
  -d '{"id":"probe","name":"x","short_name":"x","color":"#000000","faculty_key":"pef"}'
```

Expect:
- the eight ids from the first command
- `401` or `403` from the second

If the second returns `201`, delete the `probe` row at once and stop: RLS is not holding.

## 5. Upload the logos

```bash
npx tsx scripts/seed-society-logos.ts
```

The script rasterizes the eight logos from `scripts/society-logos/` and `public/reIS_logo.svg`, uploads them with `supabase storage cp --linked`, and **prints** the SQL instead of running it. Look at the PNGs in the temp directory it names, then apply the printed block:

```bash
npx supabase db query --linked "begin; update public.societies set logo_path = '…' where id = '…'; …; commit;"
```

Open one URL in a browser to confirm the file is public:
`https://zvbpgkmnrqyprtkyxkwn.supabase.co/storage/v1/object/public/society-logos/<logo_path>`

## 6. Release

Cut the release with `/release`. The extension goes to the stores by hand, as always.

## 7. Wait before the first new society

**Do not add a new society until most installs run this release.** A build from before this change has its society list compiled in: it shows a database-only society's events as **ESN**, and cannot list it for subscription.
- The extension auto-updates within about a day.
- The iOS and Android apps need a store release and the student to update, which takes weeks.

After that, adding a society is: admin console → Účty → Spolky → Přidat spolek.

## Rollback

The migration only creates objects, apart from the foreign key on `spolky_accounts`. To undo it before any new society exists:

```sql
begin;
alter table public.spolky_accounts drop constraint spolky_accounts_association_id_fkey;
drop policy society_logos_admin_select on storage.objects;
drop policy society_logos_admin_insert on storage.objects;
drop policy society_logos_admin_update on storage.objects;
drop policy society_logos_admin_delete on storage.objects;
drop table public.societies;
drop function public.societies_guard();
commit;
```

Empty the `society-logos` bucket from the dashboard, then delete it. Clients fall back to their cached catalog, then to the bundled seed.
