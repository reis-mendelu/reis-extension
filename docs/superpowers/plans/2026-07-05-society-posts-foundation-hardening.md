# Society Posts — Foundation & Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the shared Supabase project and reshape `spolky_events` into the single canonical "society post" table, so the extension-side society authoring in Plan 2 lands on a secure, unified foundation.

**Architecture:** A sequence of small SQL migrations (add post columns → engagement RPCs → venue invariants → drop `notifications` → scope PII reads → close account-email exposure), plus Supabase Auth project-setting changes and a reis-admin dashboard cleanup. Each migration is a versioned `.sql` file in `reis-extension/supabase/migrations/`, applied via the Supabase MCP and verified with `execute_sql`.

**Tech Stack:** Postgres 17 (Supabase), Supabase Auth (GoTrue), Supabase MCP tools (`apply_migration`, `execute_sql`, `get_advisors`, `generate_typescript_types`), reis-admin (Vite/React 19/TS).

## Global Constraints

- **Project:** `zvbpgkmnrqyprtkyxkwn` (`reis-notifications`), Postgres 17.
- **Migrations** live in `reis-extension/supabase/migrations/`, named `YYYYMMDDHHMMSS_desc.sql`; the files are the versioned source of truth. Apply each via Supabase MCP `apply_migration` (name = filename without extension, query = file body).
- **Execution environment:** prefer applying to a **Supabase dev branch** (`create_branch` → apply → verify → `merge_branch`) if branching is enabled on this org; otherwise apply directly (all changes here are additive or low-risk drops of unused objects). Decide once at execution start.
- **`created_by` is `text`** everywhere (mirrors `notifications.created_by` and `spolky_accounts` identity by email/`association_id`). Never `uuid`.
- **No `service_role`** in any bundle or client. Publishable key only; privilege is enforced by RLS + `get_my_role()`.
- **Every new `SECURITY DEFINER` function** sets `SET search_path = ''` and uses schema-qualified names (avoids the `function_search_path_mutable` advisor).
- **reis-admin** changes are committed in the **reis-admin repo** (`/Users/dominik-personal/Documents/reis-admin`); extension migration files are committed in this worktree.
- **Safety order:** every task in this plan must be applied and verified before Plan 2's society login is released — the login is what makes `authenticated` sessions common.
- **Do not touch** IS-Mendelu HTML parsers (none are in scope here).

**Reference — verified current schema (2026-07-05):**
- `spolky_events(id uuid, association_id text NN, title text NN, category text NN CHECK{party,boardgames,trip,quiz,sports,film,karaoke,culture,social,other}, date date NN, end_date date, time text, venue_kind text NN CHECK{campus,online,offcampus}, room_code text, coord_lng float8, coord_lat float8, location text, url text, created_at timestamptz NN, updated_at timestamptz NN)` — **1 row, no invariant violations.**
- Write RLS on `spolky_events` is **already correct**: `auth_insert/update/delete_spolky_events` = `association_id = (my active account's association_id) OR get_my_role()='reis_admin'`. SELECT = `anon`/`authenticated` `true`.
- `notifications` has the broken `Authenticated can insert notifications` (WITH CHECK = **true**) alongside the correct `auth_insert_notifications`.
- `feedback_responses` / `daily_active_usage`: SELECT policy `Allow authenticated read … (qual=true)`.
- `spolky_accounts`: SELECT policy `auth_read_all_associations_minimal (is_active=true)` exposes all active rows incl. `email`.
- `get_my_role()` = `SELECT role FROM public.spolky_accounts WHERE email = auth.jwt()->>'email' AND is_active LIMIT 1` (STABLE SECURITY DEFINER).

---

### Task 1: Add unified "post" columns to `spolky_events`

**Files:**
- Create: `supabase/migrations/20260705120000_add_post_columns_to_spolky_events.sql`

**Interfaces:**
- Produces: `spolky_events.body text`, `.created_by text`, `.view_count int NN default 0`, `.click_count int NN default 0`, `.visible_from timestamptz` — consumed by Task 2 (RPCs), Plan 2's write API, and the reis-admin events form (Task 8).

- [ ] **Step 1: Write the failing verification (run now, pre-migration)**

Run via `execute_sql`:
```sql
SELECT string_agg(column_name, ',' ORDER BY column_name) AS cols
FROM information_schema.columns
WHERE table_schema='public' AND table_name='spolky_events'
AND column_name IN ('body','created_by','view_count','click_count','visible_from');
```
Expected now: `cols = null` (none exist) — the "fail".

- [ ] **Step 2: Create the migration file**
```sql
-- 20260705120000_add_post_columns_to_spolky_events.sql
-- Unify events + notifications: spolky_events becomes the single "society post".
ALTER TABLE public.spolky_events
  ADD COLUMN IF NOT EXISTS body         text,
  ADD COLUMN IF NOT EXISTS created_by   text,
  ADD COLUMN IF NOT EXISTS view_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible_from timestamptz;
```

- [ ] **Step 3: Apply** — MCP `apply_migration(project_id, name:"20260705120000_add_post_columns_to_spolky_events", query:<file body>)`.

- [ ] **Step 4: Verify** — rerun Step 1 query.
Expected: `cols = body,click_count,created_by,view_count,visible_from`. Row-level write RLS already covers the new columns (no policy change needed).

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260705120000_add_post_columns_to_spolky_events.sql
git commit -m "feat(db): add unified post columns to spolky_events"
```

---

### Task 2: Post engagement RPCs (`increment_post_view/click`)

**Files:**
- Create: `supabase/migrations/20260705120100_post_engagement_rpcs.sql`

**Interfaces:**
- Consumes: `spolky_events.view_count`, `.click_count` (Task 1).
- Produces: `increment_post_view(row_id uuid)`, `increment_post_click(row_id uuid)` — EXECUTE granted to `anon, authenticated`. Consumed by the extension feed in Plan 2. (Old `increment_notification_*` are dropped in Task 4.)

- [ ] **Step 1: Write the failing verification (run now)**
```sql
SELECT count(*) AS fn_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('increment_post_view','increment_post_click');
```
Expected now: `fn_count = 0`.

- [ ] **Step 2: Create the migration file**
```sql
-- 20260705120100_post_engagement_rpcs.sql
CREATE OR REPLACE FUNCTION public.increment_post_view(row_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.spolky_events SET view_count = view_count + 1 WHERE id = row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_post_click(row_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.spolky_events SET click_count = click_count + 1 WHERE id = row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_view(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_post_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_click(uuid) TO anon, authenticated;
```

- [ ] **Step 3: Apply** — MCP `apply_migration(... name:"20260705120100_post_engagement_rpcs" ...)`.

- [ ] **Step 4: Verify** — functions exist and work:
```sql
SELECT id, view_count FROM public.spolky_events LIMIT 1; -- note the id + current view_count
SELECT public.increment_post_view('<that-id>'::uuid);
SELECT view_count FROM public.spolky_events WHERE id='<that-id>'::uuid; -- expect +1
```
Expected: `view_count` incremented by 1; rerun Step-1 query → `fn_count = 2`.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260705120100_post_engagement_rpcs.sql
git commit -m "feat(db): add increment_post_view/click RPCs on spolky_events"
```

---

### Task 3: Venue invariants ("always an event") on `spolky_events`

**Files:**
- Create: `supabase/migrations/20260705120200_spolky_events_venue_invariants.sql`

**Interfaces:**
- Produces: DB-level guarantees `campus ⇒ room_code`, `offcampus ⇒ coords`. `date`/`venue_kind` are already `NOT NULL` (the date requirement is already enforced).

- [ ] **Step 1: Confirm no existing row violates (run now)** — already checked: `total_rows=1, campus_missing_room=0, offcampus_missing_coords=0, missing_date=0`. Re-run to be safe:
```sql
SELECT count(*) FILTER (WHERE venue_kind='campus'    AND room_code IS NULL) AS bad_campus,
       count(*) FILTER (WHERE venue_kind='offcampus' AND (coord_lng IS NULL OR coord_lat IS NULL)) AS bad_offcampus
FROM public.spolky_events;
```
Expected: `bad_campus=0, bad_offcampus=0` (constraint will not fail on apply).

- [ ] **Step 2: Create the migration file**
```sql
-- 20260705120200_spolky_events_venue_invariants.sql
ALTER TABLE public.spolky_events
  ADD CONSTRAINT spolky_events_campus_room_chk
    CHECK (venue_kind <> 'campus' OR room_code IS NOT NULL),
  ADD CONSTRAINT spolky_events_offcampus_coords_chk
    CHECK (venue_kind <> 'offcampus' OR (coord_lng IS NOT NULL AND coord_lat IS NOT NULL));
```

- [ ] **Step 3: Apply** — MCP `apply_migration(... name:"20260705120200_spolky_events_venue_invariants" ...)`.

- [ ] **Step 4: Verify** — the constraints reject a bad insert:
```sql
BEGIN;
INSERT INTO public.spolky_events (association_id,title,category,date,venue_kind)
VALUES ('esn','bad','party',current_date,'campus'); -- no room_code
ROLLBACK;
```
Expected: ERROR `new row ... violates check constraint "spolky_events_campus_room_chk"`.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260705120200_spolky_events_venue_invariants.sql
git commit -m "feat(db): enforce campus/offcampus venue invariants on spolky_events"
```

---

### Task 4: Retire `notifications` (closes the always-true INSERT hole)

**Files:**
- Create: `supabase/migrations/20260705120300_drop_notifications.sql`

**Depends on:** Task 8's reis-admin cleanup should be applied first (removes the last code that reads/writes `notifications`). `notifications` was never a production-active feature, so no data preservation is required.

- [ ] **Step 1: Write the failing verification (run now)** — the hole exists today:
```sql
SELECT policyname, with_check FROM pg_policies
WHERE schemaname='public' AND tablename='notifications' AND cmd='INSERT';
```
Expected now: includes `Authenticated can insert notifications` with `with_check = true` (the hole).

- [ ] **Step 2: Create the migration file**
```sql
-- 20260705120300_drop_notifications.sql
-- notifications is superseded by the unified spolky_events "post" model.
DROP FUNCTION IF EXISTS public.increment_notification_view(uuid);
DROP FUNCTION IF EXISTS public.increment_notification_click(uuid);
DROP TABLE IF EXISTS public.notifications CASCADE;
```

- [ ] **Step 3: Apply** — MCP `apply_migration(... name:"20260705120300_drop_notifications" ...)`.

- [ ] **Step 4: Verify**
```sql
SELECT to_regclass('public.notifications') AS tbl,           -- expect null
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname IN ('increment_notification_view','increment_notification_click')) AS old_fns;
```
Expected: `tbl = null`, `old_fns = 0`. The broken always-true policy is gone with the table.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260705120300_drop_notifications.sql
git commit -m "feat(db): retire notifications table (unified into spolky_events)"
```

---

### Task 5: Scope PII reads (`feedback_responses`, `daily_active_usage`) to `reis_admin`

**Files:**
- Create: `supabase/migrations/20260705120400_scope_pii_reads_to_admin.sql`

- [ ] **Step 1: Write the failing verification (run now)** — a non-admin can currently read PII:
```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"email":"nobody@nowhere.invalid"}';  -- get_my_role() → null
SELECT count(*) AS visible_feedback FROM public.feedback_responses;
SELECT count(*) AS visible_usage    FROM public.daily_active_usage;
ROLLBACK;
```
Expected now: counts > 0 if rows exist (the hole: non-admin reads all).

- [ ] **Step 2: Create the migration file**
```sql
-- 20260705120400_scope_pii_reads_to_admin.sql
DROP POLICY IF EXISTS "Allow authenticated read feedback_responses" ON public.feedback_responses;
CREATE POLICY "Admin read feedback_responses" ON public.feedback_responses
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'reis_admin');

DROP POLICY IF EXISTS "Allow authenticated read daily_active_usage" ON public.daily_active_usage;
CREATE POLICY "Admin read daily_active_usage" ON public.daily_active_usage
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'reis_admin');
```

- [ ] **Step 3: Apply** — MCP `apply_migration(... name:"20260705120400_scope_pii_reads_to_admin" ...)`.

- [ ] **Step 4: Verify** — non-admin denied, admin allowed:
```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"email":"nobody@nowhere.invalid"}';
SELECT count(*) AS should_be_zero FROM public.feedback_responses;    -- expect 0
ROLLBACK;
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"email":"reis.mendelu@gmail.com"}'; -- reis_admin
SELECT count(*) AS admin_sees FROM public.feedback_responses;        -- expect all rows
ROLLBACK;
```
Expected: `should_be_zero = 0`; `admin_sees` = full count. (`daily_active_usage` behaves identically.)

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260705120400_scope_pii_reads_to_admin.sql
git commit -m "fix(db): restrict feedback_responses and daily_active_usage reads to reis_admin"
```

---

### Task 6: Close `spolky_accounts` email exposure

**Files:**
- Create: `supabase/migrations/20260705120500_drop_broad_spolky_accounts_read.sql`

**Depends on:** Task 8 (removes `GlobalActivityWidget`, the only reader that used the broad policy). Remaining readers are own-account (`App.tsx`) and admin-only (`users`, `GhostingSelector`), both covered by the surviving `auth_read_spolky_accounts` / `Users read own account` policies.

- [ ] **Step 1: Write the failing verification (run now)** — a non-admin can read another association's row (incl. email):
```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"email":"nobody@nowhere.invalid"}';
SELECT count(*) AS visible_accounts FROM public.spolky_accounts; -- expect all active rows (the hole)
ROLLBACK;
```

- [ ] **Step 2: Create the migration file**
```sql
-- 20260705120500_drop_broad_spolky_accounts_read.sql
-- Removes the policy that exposed every active account's email to any authenticated user.
DROP POLICY IF EXISTS "auth_read_all_associations_minimal" ON public.spolky_accounts;
```

- [ ] **Step 3: Apply** — MCP `apply_migration(... name:"20260705120500_drop_broad_spolky_accounts_read" ...)`.

- [ ] **Step 4: Verify** — non-admin sees only own (0 for a non-account email); admin still sees all:
```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"email":"nobody@nowhere.invalid"}';
SELECT count(*) AS should_be_zero FROM public.spolky_accounts;      -- expect 0
ROLLBACK;
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"email":"reis.mendelu@gmail.com"}';
SELECT count(*) AS admin_sees FROM public.spolky_accounts;          -- expect all rows
ROLLBACK;
```
Expected: `should_be_zero = 0`, `admin_sees` = full count.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260705120500_drop_broad_spolky_accounts_read.sql
git commit -m "fix(db): drop over-broad spolky_accounts read policy (email exposure)"
```

---

### Task 7: Supabase Auth project settings (human/dashboard) + legacy key

**Files:** none (Supabase Dashboard / Management API). **Requires a human with project access** — an agent cannot click the dashboard. Verification steps below ARE agent-runnable.

- [ ] **Step 1: Disable public sign-up.** Dashboard → Authentication → Sign In / Providers → turn OFF "Allow new users to sign up". Verify:
```bash
curl -s -X POST "https://zvbpgkmnrqyprtkyxkwn.supabase.co/auth/v1/signup" \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"probe@test.invalid","password":"Str0ngProbe!23"}'
```
Expected: HTTP 422 with `"Signups not allowed for this instance"` (or `"error_code":"signup_disabled"`).

- [ ] **Step 2: Enable leaked-password protection.** Dashboard → Authentication → Passwords → enable "Check against HaveIBeenPwned". Verify via MCP `get_advisors(project_id, type:"security")`: the `auth_leaked_password_protection` advisory is gone.

- [ ] **Step 3: Enable MFA (TOTP) and enroll the admin.** Dashboard → Authentication → Multi-Factor → enable TOTP. Enroll `reis.mendelu@gmail.com`. **Note (do not fake):** full AAL2 *enforcement* for admin writes (requiring `auth.jwt()->>'aal'='aal2'` in the `reis_admin` policy branch) is a follow-up hardening item, tracked separately — this task only makes MFA available and enrolls the admin.

- [ ] **Step 4: Verify/disable the legacy anon JWT key.** Read the key literal from `/Users/dominik-personal/Documents/reis-admin/legacy/js/config.js`, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://zvbpgkmnrqyprtkyxkwn.supabase.co/rest/v1/spolky_events?select=id&limit=1" \
  -H "apikey: <LEGACY_KEY>" -H "Authorization: Bearer <LEGACY_KEY>"
```
If `200` → the legacy JWT key is still live: Dashboard → Project Settings → API Keys → disable legacy (JWT-based) keys **after** confirming both apps use `sb_publishable_…`. If `401` → already disabled (expected per prior migration). Re-verify the apps still work with the publishable key (same curl with `$VITE_SUPABASE_PUBLISHABLE_KEY` → 200).

- [ ] **Step 5: Record completion** — no commit (settings are server-side). Note the four verifications' results in the execution log / PR description.

---

### Task 8: reis-admin cleanup (separate repo)

**Files (in `/Users/dominik-personal/Documents/reis-admin`):**
- Delete: `src/features/notifications/` (all 6 files: `index.tsx`, `NotificationForm.tsx`, `NotificationList.tsx`, `NotificationPreview.tsx`, `CalendarImportModal.tsx`, `GlobalActivityWidget.tsx`)
- Modify: `src/App.tsx` (remove import + routes, repoint default)
- Modify: `src/features/events/EventForm.tsx` (add `body`; set `created_by` on insert/update)
- Modify: `src/lib/database.types.ts` (regenerate)
- Modify: `CLAUDE.md:47` (correct stale service_role guidance)
- Check: nav/sidebar for a notifications link

- [ ] **Step 1: Remove the notifications feature.** Delete the `src/features/notifications/` directory.

- [ ] **Step 2: Repoint routes in `src/App.tsx`.** Remove `import NotificationsView from '@/features/notifications';` (line 8); delete the `/notifications` `<Route>` (line 97); change the `/` redirect (line 96) and the `*` fallback (line 103) from `to="/notifications"` to `to="/events"`.

- [ ] **Step 3: Remove any nav link to notifications.**
Run: `grep -rn "notifications" /Users/dominik-personal/Documents/reis-admin/src/components` — delete any sidebar/nav entry pointing at `/notifications`.

- [ ] **Step 4: Add `body` + `created_by` to `EventForm.tsx`.** Add a `body` textarea bound to form state; include `body` and `created_by` (the logged-in account's email or `association_id`) in the `spolky_events` insert/update payloads. Keep the component under 200 lines; extract a subcomponent if it grows.

- [ ] **Step 5: Regenerate types.** MCP `generate_typescript_types(project_id)` → overwrite `src/lib/database.types.ts`. Confirm `notifications` is gone and `spolky_events` shows the new columns.

- [ ] **Step 6: Correct `CLAUDE.md:47`.** Replace the stale `VITE_SUPABASE_SERVICE_ROLE_KEY … bypasses RLS …` bullet with: the admin uses the **publishable key only**; authorization is enforced by RLS + `get_my_role()`; `service_role` must never be used client-side.

- [ ] **Step 7: Build + verify.**
Run: `cd /Users/dominik-personal/Documents/reis-admin && npm run build`
Expected: exit 0, no references to the deleted feature. Manually load `/` → redirects to `/events`.

- [ ] **Step 8: Commit (in reis-admin repo)**
```bash
cd /Users/dominik-personal/Documents/reis-admin
git add -A
git commit -m "refactor: remove notifications feature (unified into spolky_events); fix stale service_role doc"
```

---

### Task 9: Security advisor re-scan (final gate)

**Files:** none.

- [ ] **Step 1: Run the security advisors.** MCP `get_advisors(project_id, type:"security")`.

- [ ] **Step 2: Confirm the addressed items cleared.** Verify these no longer appear:
  - `rls_policy_always_true` for `notifications` (table dropped),
  - `auth_leaked_password_protection` (Task 7),
  - any "authenticated can read" advisory tied to `feedback_responses` / `daily_active_usage` / `spolky_accounts` PII (Tasks 5–6),
  - no new `function_search_path_mutable` for `increment_post_view/click` (they set `search_path = ''`).

- [ ] **Step 3: Record remaining advisors.** List anything still open (e.g. deferred AAL2/MFA enforcement) in the execution log for the follow-up hardening pass. This closes Plan 1.

---

## Self-review

- **Spec coverage (Track A):** ①unified-post write RLS → Tasks 1–4 (columns + RPCs + invariants + drop notifications, which removes the broken policy); ②PII read-scoping → Tasks 5–6; ③sign-up gating → Task 7.1; ④service_role audit + stale CLAUDE.md → Task 7.4 + Task 8.6; ⑤leaked-password + MFA → Task 7.2–7.3; ⑥legacy key rotation → Task 7.4; ⑦engagement RPC repoint → Task 2 (+ old dropped in Task 4). reis-admin unification cleanup → Task 8. Advisor gate → Task 9. **All Track A items mapped.**
- **Deferred (correctly out of this plan):** the extension-side auth client, admin slice, write API, hidden trigger, feed repoint, and functional shell are **Plan 2**. Full AAL2 MFA enforcement is a noted follow-up (Task 7.3).
- **Type consistency:** `created_by text` throughout; RPC names `increment_post_view/click(uuid)` consistent between Task 2 (create), Task 4 (old ones dropped), and the reference block; policy names match the verified live schema.
- **Placeholder scan:** no TBD/TODO; every migration has full SQL and concrete verification; the one environment fork (branch vs direct apply) is a declared Global Constraint decision, not an in-task placeholder.
