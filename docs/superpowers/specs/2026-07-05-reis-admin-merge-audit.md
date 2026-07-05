# Audit: Merging reis-admin into the reIS extension

**Date:** 2026-07-05
**Status:** Pre-brainstorming audit (read-only). No code changed.
**Vision under evaluation:** a hidden trigger inside reIS (e.g. triple-clicking your student-ID badge) opens an admin login; admin capabilities then live *inside* reIS — map editing in the map view, statistics in a clear place, event authoring next to the map/events feature. The strategic goal: a student-society contact who already uses reIS can add an event with almost no friction.

Four parallel agents audited (1) reis-admin end-to-end, (2) the reIS host surface, (3) the auth/security boundary, (4) the shared Supabase schema. This is their synthesis.

---

## TL;DR

**The merge is architecturally coherent and the port is small — but it is NOT safe to ship as-is.** The blocker is not architecture; it's a set of pre-existing RLS holes that become mass-exploitable the moment authenticated sessions go from rare to universal.

- **One shared Supabase project** (`zvbpgkmnrqyprtkyxkwn.supabase.co`) already backs both apps. The extension is the *read* side of the same tables the admin *writes*. This is the whole reason the merge is coherent.
- **Same stack** — reis-admin is a Vite + React 19 + Tailwind 4 + DaisyUI 5 SPA (~4,750 hand-written lines, 43 files). The extension iframe is the same stack. Views are a genuine copy-port, not a rewrite.
- **Nothing in reis-admin is server-bound.** No serverless functions, no cron, no API layer, and — critically — **no service_role anywhere in code.** All privileged work is already enforced in Postgres (RLS + role-checking `SECURITY DEFINER` RPCs). Moving the UI into a public bundle changes nothing about *where* authorization happens.
- **The extension is unusually ready to host it.** Supabase is already compiled into the iframe with a publishable key; the manifest already grants the Supabase host permission; the CSP has no `connect-src` restriction. `supabase.auth.signInWithPassword()` from `chrome-extension://` would work **with zero manifest changes.**
- **The security verdict (agent 3, backed by a live scan of 93 Supabase advisors): viable in principle, unsafe today.** The merge makes obtaining an `authenticated` session trivial and universal, which converts several latent "any authenticated user" gaps into mass-exploitable ones.

---

## 1. What we'd be merging in (reis-admin)

A private ops/content back-office. Two audiences distinguished by `spolky_accounts.role`:

- **`association`** — a student union (ESN, SU PEF, AU FRRMS, …) manages *its own* notifications + campus/city events that surface in the extension.
- **`reis_admin`** — the core team; sees everything, plus admin-only tooling.

**Routes (all `src/features/*`, client-side `HashRouter`, no server):**

| Route | Purpose | Audience |
|-------|---------|----------|
| `/notifications` | society notification CRUD + activity widget + Google Calendar import | association + admin |
| `/events` | campus/city event CRUD with a Leaflet map picker (building→room, or drop-a-pin / geocode) | association + admin |
| `/accounts` | create/edit society accounts, toggle active, ghost (impersonate) | admin only |
| `/study-jams` | "reUčko" tutor/tutee matching, killer-courses | admin only |
| `/analytics` | DAU trend, unique-users, NPS feedback distribution | admin only |
| `/errors` | clusters extension telemetry into resolvable groups | admin only |

**Auth:** Supabase Auth email+password → JWT with `email` claim. Role resolved via `get_my_role()` (SECURITY DEFINER, maps JWT email → `spolky_accounts.role`, `is_active` only). Client-side `isReisAdmin` is **cosmetic** — real enforcement is RLS. "Ghosting" is pure client state that works only because `reis_admin` bypasses association scoping in every policy's `OR get_my_role()='reis_admin'` branch.

**Porting friction (all portable, none free):**
1. **supabase-js persists the session to `localStorage` by default** — banned by the extension's Iron Rules + lint. Needs a custom `chrome.storage`/IDB storage adapter, isolated from the anon client the extension already uses.
2. **Google Calendar import** uses the *sensitive* `calendar.readonly` scope via GIS popup + direct `googleapis.com` calls. The extension's existing Google flow is `launchWebAuthFlow` in the background SW with the non-sensitive `drive.file` scope — can't be lifted verbatim; would drag the project into Google verification.
3. **Leaflet tiles (CARTO) + Nominatim geocoding** are cross-origin fetches needing manifest `host_permissions`/CSP entries — won't "just work" in the iframe.

---

## 2. Where it slots in (reIS host surface)

- **No router.** Active view is a string-union `AppView` (`src/types/app.ts`) held in `useAppLogic.ts` state, switched by an `&&` chain in `AppMain.tsx`, persisted to IndexedDB. Adding a top-level "admin" view is mechanical: extend the union, add a branch, add a nav item (`menuConfig.tsx` / `MainItems.tsx`), add the id→view case in `Sidebar.tsx` + `MobileBottomNav`.
- **Store-signal → navigation precedent exists** (`mapFocusRequest` force-switches to the map view) — a clean model for "jump to admin view."
- **The events/societies consumer side is real and Supabase-backed**, not mock: `src/api/mapEvents.ts` reads `spolky_events`; `src/data/societies.ts` has 6 societies (colors/glyphs/logos/faculty). Only **RSVP is stubbed** (in-memory, `createRsvpSlice`). Event *authoring* has no presence in the extension — it lives entirely in `reis-admin/src/features/events/`.
- **The admin's map is only a picker** reusing `buildings.json` + `rooms-index.json` **duplicated** from the extension ("no shared package between the two repos"). Merging de-duplicates it. Map-*editing* in the extension would need write actions in `createMapSlice` + a click-to-pick mode in `MapCanvas` (the admin's `CampusPickerMap.tsx` is the reference).
- **Gating precedents:** `NOTES_ENABLED` compile flag (a whole dormant feature), and `src/utils/devFeatures.ts` — an IndexedDB-persisted runtime toggle with an **origin-validated postMessage bridge**. The natural hidden-trigger surface is the `select-all` student-ID badge in `ProfilePopup.tsx` (+ `MobileProfileSheet.tsx`).
- **No student-facing statistics view exists** today (success-rate charts are embedded per-subject in the file drawer, CDN-backed). An admin "statistics in a clear place" is a greenfield top-level view — and a natural fit, since the extension is where usage/feedback/error data is *generated*.

---

## 3. The data layer (shared Supabase)

**One project, one RLS surface, shared by both.** ~14 tables. The jointly-owned ones a merge unifies: `spolky_events` (central collaboration object), `notifications`, `spolky_accounts`, `killer_courses`, the three `study_jam_*` tables, `feedback_responses`, `daily_active_usage`.

- **`get_my_role()` is the linchpin** of all admin authz — a merged extension gaining an authoring surface simply adds Supabase Auth login and inherits the existing association-scoped policies.
- **4 edge functions** (`google-oauth`, `claude-proxy`, `gemini-proxy`, `eduroam-receive`) all live in the extension repo; admin has none. They hold the real secrets and **stay put**.
- **Scraper/CDN plane is cleanly orthogonal** — subject-difficulty is static jsDelivr JSON, zero Supabase. Keep separate.

**Schema debt to clean up (pre-merge or during):**
1. **`subject_ratings` has no migration at all** (dashboard-created) — capture it as a real migration with explicit RLS/RPC grants. `notifications` and `spolky_accounts` also lack `CREATE TABLE` migrations.
2. **Society identity is duplicated** — static client catalog (`src/data/societies.ts`: colors/logos/faculty) vs `spolky_accounts` rows, with brand metadata living only client-side. Promote to one canonical source.
3. **Two parallel error-triage schemes** — the v2 `error_groups` fingerprint model vs the admin's `get_error_summary`/`error_resolutions` re-aggregation. Collapse onto the fingerprint model.
4. **Migration provenance is split** across both repos — a merge should consolidate ownership.

---

## 4. Security — the gating verdict

**Viable in principle, NOT safe to merge as-is.** (Agent 3, corroborated by a live scan: 93 Supabase security advisors.)

**Why viable:** authorization is already server-enforced (RLS + `get_my_role()` + admin-gated `SECURITY DEFINER` RPCs), requires no service_role, and the publishable key is the same trust level the extension already ships. A student who triggers the login and authenticates but has **no `spolky_accounts` row** → `get_my_role()` returns NULL → every admin policy denies. The hidden trigger buys nothing security-wise (the bundle is public; anyone can invoke it) — and it doesn't need to.

**Why unsafe today — concrete, live holes the merge would amplify from latent to mass-exploitable:**
1. **`notifications` INSERT policy has `WITH CHECK = true`** (advisor `rls_policy_always_true`) — production drift from the association-scoped migration. **Any authenticated user can post a notification as any society** to all extension users.
2. **Analytics reads are `authenticated`-wide, not admin-scoped** — `feedback_responses` (hashed student_id, faculty, NPS, free-text reason) and `daily_active_usage` grant `SELECT USING(true)` to `authenticated`. The comment literally says "the admin UI already gates access" — the *"no UI to do bad things"* fallacy.
3. **`spolky_accounts` (incl. email) is readable by any authenticated user** where `is_active`.
4. **`/analytics` isn't even gated by `isReisAdmin`** — any logged-in association sees it.
5. **Public sign-up appears enabled** (account creation relies on public `auth.signUp`) — so anyone can already mint an `authenticated` session and reach #1–#3. Today it's latent because authenticated sessions are rare and the admin is a private URL. The merge makes them universal.

**Documentation landmine:** reis-admin's own `CLAUDE.md` still says it uses `VITE_SUPABASE_SERVICE_ROLE_KEY` "because this is a private admin tool." **The code no longer does this** (publishable-key-only + RLS). The stale doc prescribes the single worst mistake for a merge — correct it and confirm no `SERVICE_ROLE` var remains in Vercel. Also: a legacy anon JWT is committed in `reis-admin/legacy/js/config.js` — rotate/confirm-dead.

### Hard constraints any merge must respect (non-negotiable)
- **service_role must never enter either bundle.** Privileged server work stays behind edge functions or `reis_admin`-self-checking `SECURITY DEFINER` RPCs.
- **The publishable key gains admin power ONLY after an authenticated session whose email maps to `reis_admin`, verified server-side on every call.** Never trust `isReisAdmin` / hidden route / ghosting for authz.
- **Stop treating `authenticated` as a proxy for "admin."** The merge makes `authenticated` universal; enforce `reis_admin` explicitly everywhere sensitive.
- **`EXTENSION_SECRET` is an abuse gate, not authz.**
- Session storage adapter must be `chrome.storage`/IDB, never `localStorage`.

### Preconditions before shipping (security checklist)
- [ ] Fix the always-true `notifications` INSERT policy → association-scoped.
- [ ] Scope `feedback_responses` / `daily_active_usage` / `spolky_accounts` reads to `reis_admin` (or move behind admin-gated RPCs, like the error console).
- [ ] Confirm no `service_role` in either bundle or in Vercel env; correct the stale admin `CLAUDE.md`.
- [ ] Verify and likely disable/gate public sign-up.
- [ ] Enable leaked-password protection; add MFA for `reis_admin`; keep short inactivity logout.
- [ ] Rotate/confirm-dead the committed legacy anon JWT.
- [ ] Prefer lazy-loading / a separate entrypoint for admin code, to avoid handing every student the full schema/RPC map.

---

## 5. What this means for brainstorming

The interesting questions are **not** "can we?" (yes) or "is it a big port?" (no) — they're:

1. **Sequencing:** the security preconditions are largely independent of the UI merge and can (should) land first, in the shared Supabase project, benefiting the *current* admin too. Fix RLS before broadening who can log in.
2. **Society onboarding UX:** the actual prize is "society contact adds an event in 20 seconds." What is the minimum authoring surface inside reIS that delivers that — event form + map picker — vs. the full admin (accounts, study-jams, error triage) which may stay a separate deployment?
3. **Admin code exposure:** lazy-loaded admin chunk in one extension, vs. keeping the heavy/rarely-used admin (errors, accounts) in the standalone dashboard and only bringing the *society-facing* authoring into reIS.
4. **Canonical society model:** unifying `src/data/societies.ts` + `spolky_accounts` is a prerequisite for map/events/notifications to resolve society identity from one place.
5. **De-duplicating the map geometry** between the two repos (a shared source vs. copy).
