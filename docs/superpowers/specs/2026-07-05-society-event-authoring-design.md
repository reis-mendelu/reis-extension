# Design: Society unified-event authoring in reIS, on a hardened auth/RLS foundation

**Date:** 2026-07-05
**Status:** Design approved in brainstorming; ready for implementation planning.
**Predecessor:** [`2026-07-05-reis-admin-merge-audit.md`](./2026-07-05-reis-admin-merge-audit.md) — the four-agent audit this design is scoped from.

## Summary

First, bounded increment of bringing reis-admin capabilities into the reIS extension. A **student-society contact logs into reIS** (via a hidden trigger) and authors **"society posts"** directly inside the extension — the collaboration north-star: "a society contact who already uses reIS adds an event in seconds."

Two tracks:

- **Track A — Security hardening** of the shared Supabase project. Independent of any UI, protects the *current* dashboard too, and lands **first**.
- **Track B — Society unified-event authoring** inside reIS: handle+password login, an admin auth slice, and a write API against a **repurposed `spolky_events` table** that unifies the old `events` and `notifications` concepts into one "post."

The **presentational authoring UI** (login screen, authoring form, "my posts" list) is deliberately deferred to a **follow-up UI spec** — it must feel seamlessly native, and will be designed collaboratively. This spec delivers the data model, security, and auth *plumbing*, plus a minimal functional shell so the flow is testable end-to-end.

## Decisions locked in brainstorming

1. **First surface = society event authoring only.** Core-team tools (analytics, error triage, accounts, study-jams) stay in the standalone dashboard for now.
2. **Events and notifications are ONE thing** — unified into a single "society post." No conceptual distinction.
3. **Every post is "always an event"** — requires a date + a venue; always surfaces in both the map and the feed. (Venue may be `online`, which shows in the feed without a map pin.)
4. **Unify by repurposing `spolky_events`** (approach ①) — the table the extension map already reads. `notifications` is **retired outright** (never production-active, so no archive/migration).
5. **Track A = the full audit hardening checklist**, not just the society-gating subset.
6. **Login = society handle + password** (e.g. `supef`), mapped to a synthetic email under the hood. Accounts provisioned in the dashboard; password resets are admin-driven. MFA is `reis_admin`-only.

## Scope

**In scope**
- Track A security hardening (full checklist below).
- Track B: society login inside reIS + unified-post write API + admin auth slice + the data-model migration + a minimal functional authoring/login shell.

**Non-goals (explicitly deferred)**
- The **native authoring UI/UX** — separate follow-up spec.
- Bringing **analytics, error triage, accounts, study-jams** into reIS.
- **Map editing** (moving buildings/rooms), **RSVP backend**, **society-catalog unification** (`src/data/societies.ts` ↔ `spolky_accounts`), and **migration-provenance consolidation** — future increments.

---

## Track A — Security hardening

Landing first, independently deployable. The society login is what makes `authenticated` sessions common, so every item here must be verified before Track B's login is released to users.

1. **Unified-post write RLS.** `spolky_events` keeps its correct policy: `INSERT/UPDATE/DELETE` allowed only when `authenticated AND (association_id = my association OR get_my_role()='reis_admin')`. Retiring `notifications` deletes its broken `WITH CHECK = true` INSERT policy entirely — this is the headline hole from the audit, closed by construction.
2. **Read-scope the PII tables.** Restrict `feedback_responses`, `daily_active_usage`, and `spolky_accounts` reads to `reis_admin` — either via RLS keyed on `get_my_role()`, or moved behind admin-gated `SECURITY DEFINER` RPCs (the pattern the error console already uses). Closes the "any authenticated user dumps feedback / student usage / society emails" holes.
3. **Gate public sign-up.** Disable open `auth.signUp` so a random cannot mint an `authenticated` session. Account creation stays admin-driven in the dashboard.
4. **service_role audit.** Confirm no `service_role` / secret key in either bundle or in Vercel env. Correct the stale `reis-admin/CLAUDE.md` that still prescribes `VITE_SUPABASE_SERVICE_ROLE_KEY` (the code no longer uses it).
5. **Auth project settings.** Enable leaked-password protection; require **MFA for `reis_admin`** accounts; keep the short inactivity logout.
6. **Rotate/confirm-dead** the committed legacy anon JWT in `reis-admin/legacy/js/config.js`.
7. **Repoint engagement RPCs.** `increment_notification_view` / `increment_notification_click` → operate on `spolky_events` (rename to `increment_post_view` / `increment_post_click`).

---

## Track B — Data model: the unified `spolky_events` "society post"

**Existing columns retained:** `id`, `association_id`, `title`, `category` (10-value CHECK), `date`, `end_date`, `time`, `venue_kind` ∈ `{campus, online, offcampus}`, `room_code`, `coord_lng`, `coord_lat`, `location`, `url`, `created_at`, `updated_at`.

**Columns added (absorbed from `notifications`):**

| Column | Type | Purpose |
|---|---|---|
| `body` | text | post description (feed + detail card) |
| `created_by` | uuid/text | authoring account, for audit + "your posts" filtering |
| `view_count` | int, default 0 | engagement, bumped by `increment_post_view` |
| `click_count` | int, default 0 | engagement, bumped by `increment_post_click` |
| `visible_from` | timestamptz, null | optional "publish at"; feed hides the post until then (default = now) |

**Deliberately omitted (YAGNI):** `priority` (feed orders by date), `expires_at` (the event's `date`/`end_date` is the natural expiry), and a separate `link` (existing `url` covers it).

**Invariants** (CHECK constraints + enforced in the authoring layer, per "always an event"):
- Every row has a non-null `date` and `venue_kind`.
- `venue_kind='campus'` ⇒ `room_code` present (coord resolved from building centre).
- `venue_kind='offcampus'` ⇒ `coord_lng`/`coord_lat` present.
- `venue_kind='online'` ⇒ neither required (feed-only, no map pin).

**RLS**
- `SELECT`: `anon` reads all (map + feed are public to students). Unchanged.
- `INSERT/UPDATE/DELETE`: `authenticated AND (association_id = my association OR get_my_role()='reis_admin')` — the single write path once `notifications` is gone.

**Consumers**
- Map: `src/api/mapEvents.ts` already reads `spolky_events` — **untouched** (regression guard).
- Feed: `src/services/spolky/spolkyService.ts` is repointed from `notifications` to `spolky_events`. Since the notification feed was never production-active, this is low-risk; its exact presentation folds into the deferred UI spec.

---

## Track B — Society auth inside reIS

- **Login mechanism:** reuse Supabase **email+password** auth, run inside the reIS iframe with the publishable key already in the bundle. `chrome-extension://` → Supabase auth endpoint works with **no manifest change** (audit-confirmed: host permission granted, CSP has no `connect-src` limit).
- **Handle login:** the society types **handle + password** (`supef`). The client maps handle → a deterministic **synthetic email** `<handle>@societies.reis.invalid` and calls `signInWithPassword`. The same synthetic email is stored as `spolky_accounts.email`, so `get_my_role()` (resolves by `auth.jwt()->>'email'`) is **unchanged**. Handle == existing `association_id` (`esn`, `supef`, `au_frrms`, `af`, `ldf`, `zf`).
  - *Why a synthetic email at all:* Supabase Auth keys logins on email (or phone), not username — there is no bare-handle login. The synthetic address is an internal artifact the society never sees or types; it receives no mail, needs no MX/mailbox, and uses the RFC 2606 reserved `.invalid` TLD so it can never be a real deliverable address. The alternative — replacing Supabase Auth with a custom JWT-minting scheme — would discard the reused `RLS + get_my_role()` model and add auth surface to secure, for no user-visible benefit.
- **Provisioning:** accounts created in the dashboard with email confirmation disabled/auto-confirmed (no inbox needed). Password resets are admin-driven (no self-service email reset — acceptable/preferable for a shared society account).
- **Session storage:** a custom `chrome.storage.local` adapter passed to `createClient(..., { auth: { storage, persistSession: true } })`. **Never `localStorage`** (Iron Rule). This admin auth client is **separate** from the anon read/telemetry client — student reads never carry an admin JWT.
- **Entry:** the hidden trigger — triple-click (desktop) / long-press (mobile) the `select-all` student-ID badge in `ProfilePopup.tsx` / `MobileProfileSheet.tsx` → opens the login overlay via `AppOverlays`. The trigger is **not** a security boundary (bundle is public); all authz rests on RLS + `get_my_role()`.
- **Authz slice:** `createAdminSlice` holds `session | role | associationId | isAssociation`, hydrated at startup from the persisted session. A student who authenticates but has no `spolky_accounts` row → `get_my_role()` = NULL → every write denied. No client-trusted authz (`isAssociation` gates UI only, never data access).

---

## Track B — Code architecture

All new plumbing; the presentational screens are the deferred UI spec (this spec ships a minimal functional DaisyUI shell so the flow is testable end-to-end).

| Unit | File | Responsibility |
|---|---|---|
| chrome.storage session adapter | `src/services/admin/chromeStorageAdapter.ts` | implements supabase-js's `storage` interface over `chrome.storage.local` |
| Handle→email mapping | `src/services/admin/societyLogin.ts` | `supef` → `supef@societies.reis.invalid`; pure, tested |
| Admin auth client | `src/services/admin/authClient.ts` | separate `createClient` with the adapter + `persistSession`; isolated from the anon client |
| Admin auth slice | `src/store/slices/createAdminSlice.ts` | `session/role/associationId/isAssociation`; `login(handle,pw)/logout/loadSession`; registered in `store/types.ts` + `useAppStore.ts`, hydrated in `initializeStore()` |
| Society-post write API | `src/api/societyPosts.ts` | `createPost/updatePost/deletePost/listMyPosts` — RLS-gated writes to `spolky_events` |
| Hidden trigger | edits to `ProfilePopup.tsx` + `MobileProfileSheet.tsx` | triple-click / long-press badge → store action opens the login overlay |
| Feed repoint | `src/services/spolky/spolkyService.ts` | read `spolky_events` instead of `notifications` |
| Functional shell (temporary) | overlay + form components via `AppOverlays` | minimal DaisyUI login + authoring + "my posts" list; **redesigned in the follow-up UI spec** |

**File-size discipline:** keep each unit under the 200-line convention; split the authoring form if it grows.

---

## Cross-repo coordination

- **Supabase migrations** land in `reis-extension/supabase/migrations/` (this repo becomes the hub). Provenance-consolidation of the split migration history is noted cleanup, not this spec.
- **reis-admin:** remove the now-dead notifications route/screen; its events form keeps working against the unified table (small add for `body`/`created_by`); regenerate `database.types.ts`; correct the stale `CLAUDE.md` (Track A #4).
- **Supabase project settings** (via Supabase MCP or console): disable public sign-up; enable leaked-password protection; MFA for `reis_admin`.

---

## Rollout / sequencing (safety-ordered)

1. **Track A first, fully** — including the unified migration (extend `spolky_events`, drop `notifications` + its broken policy) and PII read-scoping, sign-up gating, service_role audit, key rotation, and auth settings.
2. **Then Track B** — auth client + slice + write API + hidden trigger + functional shell. The society login is **not released to users until Track A hardening is verified**, because the login is exactly what makes `authenticated` sessions common.
3. **Follow-up UI spec** — native authoring UX.

---

## Testing (TDD — repo's "test first" rule)

- **Unit:** chrome.storage adapter round-trip (mocked `chrome.storage`); handle→email mapping; `createAdminSlice` (login ok/fail, logout clears, hydration, no-role ⇒ not association); `societyPosts` API payloads (mocked supabase client).
- **RLS integration** (the real security assertion) — on a Supabase branch via `execute_sql`:
  - society A **cannot** insert/update/delete society B's posts;
  - `anon` **cannot** write; `anon` **can** read;
  - a no-role `authenticated` session is **denied** all writes;
  - the retired `notifications` table / broken policy is gone;
  - the PII tables (`feedback_responses`, `daily_active_usage`, `spolky_accounts`) reject non-`reis_admin` reads.
- **Regression guard:** existing `mapEvents` map-consumer tests stay green (map read path untouched).
- **CI gates:** changed-files `eslint --max-warnings=0` and `npm run build` (exit 0) before any push.
- **Parser rule:** N/A — no IS-HTML parser is touched here.

---

## Deferred to follow-up specs

- **Native authoring UI/UX** (the immediate next spec) — login screen, authoring form, "my posts" management, and how all of it integrates seamlessly into reIS.
- Analytics / error triage / accounts / study-jams into reIS.
- Map editing, RSVP backend, society-catalog unification, migration-provenance consolidation.
