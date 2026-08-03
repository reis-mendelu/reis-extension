# Suggestions inbox — replacing the Discord feedback webhook

**Date:** 2026-08-03
**Resolves:** [#163](https://github.com/reis-mendelu/reis-extension/issues/163)
**Scope:** move feedback delivery off the client-side Discord webhook; land suggestions in Supabase and read them inside reIS as `reis_admin`.
**Not in scope:** the unhashed `studentId` in `createStudyJamsSlice` (tracked separately, see `2026-07-26-capacitor-assumption-audit.md`).

---

## Decision

Feedback stops going to Discord entirely. It is written to a new `suggestions` table through an Edge Function, and read inside the extension by whoever is logged in as `reis_admin`.

**This collapses the issue's "required human step".** #163 assumed a rotation: land the server-side change, create a *new* webhook, hand over the secret. With no Discord destination at all, the step is **delete the webhook in Discord** — the leaked credential dies and nothing replaces it.

**Rejected: email notification (Brevo/Resend/Apps Script).** Explored in detail and dropped. reIS has no domain, so transactional providers can only mail the account owner without domain verification; Brevo's single-verified-sender path worked around that, but the in-app inbox made the whole transport unnecessary. Recorded here so it is not re-litigated.

**Rejected: a reis-admin dashboard page.** A second triage UI in a dashboard you log into less often than reIS itself. YAGNI.

---

## What already works — verified, not assumed

| Claim | Evidence |
|---|---|
| Society/admin session persists for weeks | `auth.sessions` holds 13 live sessions, oldest created **2026-07-05**, newest touched **2026-08-03**; 13 unrevoked refresh tokens |
| Session survives reload, not in localStorage | [authClient.ts](../../../src/services/admin/authClient.ts) — `persistSession`/`autoRefreshToken`, storage = `chromeStorageAdapter` → `chrome.storage.local`, key `reis_admin_auth` |
| Works on Firefox and in the Capacitor WebView | [chromeStorageAdapter.ts](../../../src/services/admin/chromeStorageAdapter.ts) prefers promise-based `browser.*` (raw `chrome.*` is callback-based on Firefox and would silently drop the session), falls back to `getPlatform().storage` where no `chrome` binding exists. 5 tests pass |
| Every iframe open rehydrates the session and re-resolves the role | [useAppStore.ts:127](../../../src/store/useAppStore.ts) calls `loadAdminSession()` in Tier-1 boot |
| Deactivating an account revokes access at next boot | `resolveAccount` → null role forces `signOut()`; `get_my_role()` requires `is_active = true` |
| Both maintainers already have access | `spolky_accounts` holds exactly one `reis_admin` row — `reis.mendelu@gmail.com`, `association_id: 'reis'`, active since 2026-02-18. A **shared** login, so no new auth user and no migration is needed |
| An admin-only read gate already exists | `get_my_role() = 'reis_admin'` is the same policy shape guarding `feedback_responses` |
| The UI surface exists and is empty | [SocietyAdminOverlay.tsx](../../../src/components/SocietyAdmin/SocietyAdminOverlay.tsx) shows a logged-in admin only `reisAdminNote` + logout; associations are routed to society map mode instead, so that state is de-facto reis_admin-only real estate |

**Consequence of the shared login:** `status` records *that* something was triaged, never *who*. Accepted; per-person attribution would need a second row and is not worth it here.

---

## Blockers found while verifying — fix before implementing

1. **The dev webapp cannot reach this feature.** [useAppStore.ts:115-128](../../../src/store/useAppStore.ts) — when `DEV_SOCIETY` is set, boot seeds a fake **`association`** session and **skips `loadAdminSession()` entirely**. At `localhost:3000` you are permanently the wrong role and the inbox never renders. Since dev:web is how UI gets verified (see the `verify-ui` and `dev-real-data` skills), the dev seed must accept a `reis_admin` role first. Without this the feature is unverifiable.

2. **This worktree's `node_modules` is stale.** Both `SocietyAdmin` test files fail to *collect* with `Failed to resolve import "@capacitor/core"` — declared in `package.json`, absent from `node_modules`, fallout from the Capacitor commit. Not a code regression, but the overlay's existing tests are currently unverified. Run `npm install`.

---

## Naming

**`suggestions`**, not "feedback" and not "notifications". Both names are already taken in this codebase and mean different things:

- `feedback_responses` / `createFeedbackSlice` / `NpsBanner` = the per-semester NPS and subject-rating pipeline, keyed by hashed student ID.
- `notifications` / `createNotificationSlice` / `NotificationFeed` = the **student-facing** society feed, now read from `spolky_events`. The `notifications` table itself was dropped in `20260705120300` for being superseded *and* for carrying an always-true INSERT policy — it is not coming back.

---

## Data model

```sql
create table public.suggestions (
  id              bigint generated always as identity primary key,
  type            text not null check (type in ('bug','idea','other')),
  title           text not null check (char_length(title) between 1 and 120),
  body            text not null check (char_length(body) between 1 and 2000),
  contact         text          check (char_length(contact) <= 120),
  screen          text not null check (char_length(screen) <= 40),
  ext_version     text not null default '',
  browser_name    text not null default '',
  browser_version text not null default '',
  viewport        text not null default '',
  status          text not null default 'new' check (status in ('new','triaged','done')),
  created_at      timestamptz not null default now()
);
alter table public.suggestions enable row level security;
```

Reads and status writes are gated on the existing role helper:

```sql
create policy "Admin read suggestions" on public.suggestions
  for select to authenticated using (public.get_my_role() = 'reis_admin');

create policy "Admin update suggestion status" on public.suggestions
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');
```

**RLS cannot restrict *which columns* an update touches** — that needs a column grant, and Supabase grants broadly on `public` by default, so revoke first:

```sql
revoke all on public.suggestions from anon, authenticated;
grant select on public.suggestions to authenticated;
grant update (status) on public.suggestions to authenticated;
```

Net effect: nobody inserts or deletes except the service-role Edge Function; an admin session can read everything and change only `status`.

### Rate limiting

```sql
create table public.suggestions_rate_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.suggestions_rate_log enable row level security;  -- deny-all
create index suggestions_rate_log_hash_time on public.suggestions_rate_log (ip_hash, created_at);
```

`check_and_log_suggestion(p_ip_hash text, p_max int default 5)` — `SECURITY DEFINER`, `set search_path = public`, structurally the same as `check_and_log_booking`, including `pg_advisory_xact_lock(hashtext(p_ip_hash))` before the count-then-insert so two concurrent submissions can't both read the old count and bypass the cap (TOCTOU). Execute granted to `service_role` only.

Two deliberate differences from the booking log:

- **The salt fails closed.** `SUGGESTION_HASH_SALT` absent → the function refuses, exactly as `BOOKING_HASH_SALT` does. A raw or unsalted IP is personal data; the salt is what makes it pseudonymous.
- **It prunes.** Rows older than 24h are deleted inside the same call. `library_bookings_log` never got this and accumulates indefinitely; this table should not become a growing record of who submitted from where.

---

## Edge Function — `submit-suggestion`

`verify_jwt = false`, gated on `x-reis-extension-secret`, publishable key in the `apikey` header — the shape all four existing proxies use. The extension secret ships in the bundle and is therefore not truly secret; the **rate limit is the real abuse boundary**, exactly as documented for `bookings-create`.

Order of operations:

1. **Validate.** `type` in enum; `screen` against the `AppView` allowlist; lengths within the CHECK bounds. Anything else → 400.
2. **`check_and_log_suggestion(ip_hash, 5)`** → false → 429, nothing stored.
3. **Insert** via the service-role client. Failure → 500, and the modal's existing error toast fires, because the suggestion genuinely did not land.

Secrets: `EXTENSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUGGESTION_HASH_SALT`.

---

## Context payload — what the client sends

The current payload sends `window.location.href`, which on IS routinely carries `studium=`, `obdobi=`, `predmet=`, `termin=`. That contradicts the project's own rules: `sanitize.ts` redacts every `*.mendelu.cz` URL and every 6–7-digit ID before telemetry leaves, and CLAUDE.md states IS data is never transmitted.

**The URL is removed outright and replaced by the reIS screen** — the `AppView` union from [src/types/app.ts](../../../src/types/app.ts): `calendar | exams | settings | timeline-demo | subjects | studyPlan | erasmus | iskam-dashboard | map`.

Running the URL through `sanitize.ts` was rejected: the sanitizer redacts `*.mendelu.cz` URLs wholesale, so the field would always arrive empty — shipping a column that never carries information. The screen id is what was actually wanted: it says where the bug is, it is a fixed nine-value set, and it derives from the app's own state rather than from the host page.

Also fixed at the same site: `version: '4.0.0'` is hardcoded in the modal and stale. Use `chrome.runtime.getManifest().version`, as `telemetry.ts` already does.

`contact` remains collected — it is how you reach the student — and remains PII, readable only under the `reis_admin` policy.

---

## Client changes

**New**

- `supabase/migrations/<ts>_suggestions.sql`
- `supabase/functions/submit-suggestion/index.ts`
- `src/api/suggestions.ts` — submit via the Edge Function; list and `setStatus` via `adminAuthClient` (an authenticated session, so RLS applies and no service-role key goes near the client)
- `src/store/slices/createSuggestionsSlice.ts` — `items`, `unreadCount`, `loadSuggestions()`, `setStatus()`
- `src/components/SocietyAdmin/SuggestionsInbox.tsx`

**Modified**

- `createAdminSlice.ts` — after `loadAdminSession()`/`adminLogin` resolve `reis_admin`, call `loadSuggestions()`. Fetching lives in the store, never in a `useEffect` (Iron Rule).
- `useAppStore.ts` — dev seed accepts `reis_admin` (blocker 1).
- `SocietyAdminOverlay.tsx` — the inbox replaces the dead-end `reisAdminNote`.
- `ProfilePopup.tsx` / `MobileProfileSheet.tsx` — unread badge, rendered **only when `adminRole === 'reis_admin'`**. The entry point is a hidden triple-click on the profile badge; an unconditional badge would advertise that door to every student.
- `FeedbackModal.tsx` — posts to the Edge Function, sends `screen` instead of `href`.
- `src/constants/config.ts` — **deleted**; `DISCORD_WEBHOOK_URL` is its only export.
- `PRIVACY.md` — drop the Discord webhook (§ storage) and Discord from the third-party list; document the new destination and the hashed-IP rate limit, which is new personal-data processing.
- `i18n/locales/{cs,en}.json` — inbox strings.

**Notification on open:** after the boot-time role resolve, if `unreadCount > 0` a `sonner` toast fires. It is a pull, not a push — nothing arrives while the browser is shut. Dismissing the toast does not clear the count; only changing `status` does, so nothing is silently lost.

Files stay under the 200-line convention; the inbox list is its own component rather than growing the overlay.

---

## Testing

Test-first, per Iron Rules.

- `src/api/__tests__/suggestions.test.ts` — payload contains `screen` and **no** `window.location.href`; rejects a screen outside the allowlist; version read from the manifest.
- `src/store/slices/__tests__/createSuggestionsSlice.test.ts` — unread count; `setStatus` updates optimistically and reverts on error.
- `src/components/SocietyAdmin/__tests__/SuggestionsInbox.test.tsx` — renders items for `reis_admin`; renders nothing without that role.
- Badge visibility test — absent for a student session, present for `reis_admin`.
- **Policy check by hand, not by unit test:** query `suggestions` as `anon` (expect 0 rows), as an `association` session (expect 0 rows), as `reis_admin` (expect rows), and attempt an update of a non-`status` column as `reis_admin` (expect refusal). RLS is the actual security boundary and no vitest run exercises it.
- UI verified at 320/390/430 via the `verify-ui` skill — the inbox is a list of student-authored text of arbitrary length, so overflow is the live risk.

---

## Rollout order

0. **Human step, do now: delete the webhook in Discord.**
1. `npm install` in the worktree; confirm the `SocietyAdmin` suites collect and pass.
2. Dev-seed fix, so the feature can be seen at `localhost:3000`.
3. Migration.
4. Deploy `submit-suggestion` + set its three secrets.
5. Client swap, tests, UI verification.
6. Release through the normal `/release` flow.

**Why the delete moves first (decided 2026-08-03).** The ordering question was whether killing the webhook before the replacement ships would break feedback for users on the old build. Checked against `daily_active_usage`: weekly active users fell from **86** (w/c 2026-05-25) to **2–5** across all of July, and 2 in the current week. Post-exam usage is effectively nil, so the population that could hit the modal in the gap is a handful of people, and the cost of a failed submission — a visible error toast, no silent loss — is negligible against leaving a known-compromised credential live for several more weeks.

Between the delete and the release, `FeedbackModal` posts to a dead URL and shows its error toast. That is the accepted state, not a regression to debug.

Note that deleting the line from `config.ts` revokes nothing — the URL is in git history on a public repo. Only the Discord-side delete does.

---

## Footnote: secret scanning did not catch this

Per #163, `/secret-scanning/alerts` is empty — GitHub's scanner does not flag Discord webhook URLs here, so this class of leak will not be caught automatically next time. Out of scope for this change; worth its own ticket if the pattern recurs.
