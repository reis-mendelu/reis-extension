# Societies live in Supabase, not in the code

**Date:** 2026-09-26
**Status:** design approved in chat, awaiting spec review

## Problem

Adding a student society today is a code change and a release. Its identity is
spread across three hardcoded structures and a folder of shipped images:

| Where | Holds | Read by |
| --- | --- | --- |
| `src/data/societies.ts` (`SOCIETIES`) | name, shortName, color, glyph, logo path, facultyKey | map, event card, Novinky logo, admin picker, calendar host |
| `src/services/spolky/config.ts` (`ASSOCIATION_PROFILES`) | name, websiteUrl, facultyIds, audienceLabelKey | Novinky sender name, subscription list, audience label |
| `src/services/spolky/config.ts` (`FACULTY_TO_ASSOCIATION`) | faculty → default society | first-run auto-subscribe |
| `public/spolky/*.jpg`, `ey.svg` | logos | everything above |

The database already accepts any society id (`society-accounts` creates an
account for any valid username; nothing constrains `association_id`). Only the
client's compiled catalog knows which societies exist.

## Goal

A reIS admin adds, edits or hides a society, including its logo, from the admin
console. No code change, no release.

## Non-goals

- Societies editing their own branding. Only `reis_admin` writes (decided in chat).
- Changing a society's **id**. It is the login and the RLS key; renames change display fields only.
- A website field. `websiteUrl` is read nowhere and is deleted.

## 1. Data model

### `public.societies`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | `check (id ~ '^[a-z0-9][a-z0-9_-]*$')`, same rule as `society-accounts/password.ts`. Immutable: an `update` trigger rejects a changed `id`. |
| `name` | `text not null` | "SU PEF" |
| `short_name` | `text not null` | "SUPEF": event card "hosted by", calendar host, glyph source |
| `color` | `text not null` | `check (color ~ '^#[0-9a-fA-F]{6}$')`. Contrast is validated in the form (below), not in SQL |
| `faculty_key` | `text not null` | `check (faculty_key in ('mendelu','pef','af','ldf','zf','frrms'))`, mirrors `FacultyKey` |
| `auto_follow_faculty` | `boolean not null default false` | new students of `faculty_key` follow it on first run. Partial unique index: at most one `true` per `faculty_key` |
| `audience_label` | `text null` | `check (audience_label in ('erasmus'))`. Set by SQL for ESN only, not in the form |
| `logo_path` | `text null` | object path inside `society-logos`, never a full URL |
| `sort_order` | `int not null default 0` | |
| `is_active` | `boolean not null default true` | inactive = hidden from pickers and subscription lists, still resolvable for old events |
| `updated_at` | `timestamptz not null default now()` | |

RLS:
- `select` to `anon, authenticated` using `true`. Every column is public branding.
- `insert`/`update` to `authenticated` when `get_my_role() = 'reis_admin'`.
- No `delete` policy. Hiding is `is_active = false`, because events and accounts keep referencing the id.

`glyph` is not stored: the client derives it from `short_name` (it only shows when a logo is missing).

`facultyIds` from `ASSOCIATION_PROFILES` is not stored: it duplicates `faculty_key`
(`eventAudience.ts` maps it back to the same faculty).

### Foreign key

`spolky_accounts.association_id references societies(id)`, added after the seed,
inside a block that aborts if any account points at a missing society. The
`reis_admin` account's `association_id` is `reis`, which is seeded.

`spolky_events.association_id` gets **no** FK. The USAF migration documents that
posts can outlive accounts, and they must keep resolving.

### Storage: `society-logos`

- Public bucket. `allowed_mime_types = {image/png, image/webp}`, `file_size_limit = 256 KB`.
- `insert`/`update`/`delete` on `storage.objects` for this bucket when `get_my_role() = 'reis_admin'`.
- Object path is `<society_id>/<content-hash>.<ext>`. A new logo is a new path, so a CDN-cached old logo is never served under the new row.
- SVG is not accepted: a public SVG opened directly on the Supabase origin can run script. The seed rasterizes `ey.svg`.

### Seed

A migration inserts the 8 current rows with today's values (`reis` included,
`esn` with `audience_label = 'erasmus'`). The defaults for `auto_follow_faculty`
come from `FACULTY_TO_ASSOCIATION`: supef, au_frrms, usaf, zf, ldf.

`scripts/seed-society-logos.ts` uploads `public/spolky/*` (and rasterized
`ey.svg`, `reIS_logo.svg`) as PNG, then sets `logo_path`. It is run once, by hand,
with the admin credentials, after the migration.

Applying the migration is manual (`npx supabase db query --linked -f`), as for
every migration here. Merging to `test` does not apply it.

## 2. Client

Everything below is shared code, so it lands on the extension and the phone/iPad
tree at once.

### Catalog slice

A new `createSocietiesSlice` replaces `SOCIETIES`, `ALL_SOCIETIES`,
`ASSOCIATION_PROFILES` and `FACULTY_TO_ASSOCIATION`:

- State: `societies: Record<string, Society>`, `societiesLoaded`.
- `Society` merges both shapes: `id, name, shortName, color, facultyKey, logoUrl | null, autoFollowFaculty, audienceLabel, sortOrder, isActive`. `logoUrl` is built from `logo_path` with the project's public storage URL.
- **Seed:** the slice starts from a bundled copy of today's 8 societies (the file that replaces `data/societies.ts`), so a first offline launch and `check:app` render real names, colours and faculties. The seed's logos are the storage URLs; offline, a logo that cannot load falls back to the glyph tile (below).
- **Cache:** the fetched catalog is written to IndexedDB (`meta`, key `societies_catalog`) and read on boot before any network.
- **Refresh:** `loadSocieties()` runs with `loadMapEvents`/`reloadMapEvents`, and on native app resume (fetch-once-at-startup is stale forever in Capacitor).
- **Fetcher:** `src/api/societies.ts`, a plain `select` on `societies`. Added to `SUPABASE_CALLERS` with its justification: an anonymous read of public branding, no identity, no student data.

`useAppStore` reads stay synchronous; components call a selector, never the API.

### Resolution rules

- `societyById(id)` returns the catalog entry, else a **neutral** society: grey, glyph from the id, `facultyKey: 'mendelu'`, no logo. It no longer falls back to ESN, because a cached catalog older than a new society would otherwise brand that society's events as ESN. An unknown id also triggers one catalog refetch (debounced).
- NotificationItem keeps its rule: an id that is not a society (reIS announcements, academic rows) shows the bell, not a logo.
- **Faculty is resolved on read.** `toMapEvent` stops baking `organizerKey: soc.facultyKey` into the event at fetch time; the faculty filter resolves it from `societyId` through the catalog. Otherwise an event mapped before the catalog loaded keeps the wrong faculty.
- **Auto-follow waits for the catalog.** `useSpolkySettings` computes first-run defaults only after `societiesLoaded` (the bundled seed counts), so an early boot cannot persist an empty default.
- `RENAMED_ASSOCIATION_IDS` and `migrateAssociationIds` stay unchanged and permanent.

### Logos

Every logo `<img>` (EventDetailCard, SocietyChip, NotificationItem, subscription
rows) gets an `onError` fallback to the coloured glyph tile at the same size.
Today only NotificationItem has one.

### Removed

- `public/spolky/`, once the seed script has uploaded it.
- `websiteUrl`, `AssociationProfile`, `FACULTY_TO_ASSOCIATION`, `FacultyId`.

## 3. Admin console

`SocietyAccountsPanel` becomes **Societies**. It is one component rendered by both
`AdminConsole` and `MobileAdminConsole`, so both admin variants get it. It is
visible only to `reis_admin`, as today.

**List:** every society (active and hidden) with logo, name, faculty, account
status, and the existing reset-password action.

**Add society** (one form, one submit):
1. `id` (becomes the login), name, short name, colour, faculty (five faculties or "Celá MENDELU"), "new students of this faculty follow it automatically".
2. Logo upload: picked file → cropped to a centered square → re-encoded on the device to 256×256 PNG through a canvas (reuses `imageNormalize`, which also strips metadata). Preview shown before submit.
3. Submit order: upload logo → insert `societies` row → `createSocietyAccount` (existing edge function). The generated password is shown once, as today. If account creation fails, the row stays and the list offers "Create account" for it; the society is usable for branding either way.

**Edit:** same fields except `id`; replacing the logo uploads a new path and
updates `logo_path`. The old object is deleted after the row update succeeds.

**Hide / show:** toggles `is_active`.

**Colour validation:** the form rejects a pin colour whose contrast against the
light basemap, or whose white glyph text, fails the ratio `readableTextColor`
uses, and says why. The basemap is always light (map visual rules).

**Auto-follow conflict:** ticking the box when another society already holds it
for that faculty shows who holds it and moves it on confirm.

## 4. Privacy

- `privacy/disclosures.ts`: a new `call` entry for the `societies` read and the logo downloads. What is sent: nothing beyond the request itself (no install id, no student data). Then `npm run privacy:generate`.
- The `noStudentDataLeaves` guard: `src/api/societies.ts` joins `SUPABASE_CALLERS` with a written justification. Admin writes go through the existing admin client files.
- Students' devices already contact the same Supabase project for events, so no new third party appears.

## 5. Rollout

1. Merge the PR (via `test`). Apply the migration by hand. Run the logo seed script.
2. Ship the release to all stores.
3. **Wait before adding the first new society.** A copy of the app released before this change resolves a database-only society to ESN (the same exposure the USAF migration recorded). Add it once most installs are on this release; iOS adoption lags the extension.

## 6. Testing

Test-first, per the repo's rules:

- Slice: seed → cache → fetch precedence; a fetch failure keeps the cache; unknown id → neutral society plus one refetch.
- `toMapEvent` no longer carries a faculty; the faculty filter resolves it from the catalog, including for a catalog that loads after the events.
- `useSpolkySettings`: defaults wait for `societiesLoaded`; `auto_follow_faculty` replaces `FACULTY_TO_ASSOCIATION`.
- Logo `onError` fallback on every logo surface.
- Admin form: validation (id format, colour contrast, required logo), submit order, partial failure (row created, account not).
- The logo encoder: square crop, 256×256 PNG, metadata stripped.
- SQL, verified against a local Postgres + PostgREST stub (history cannot replay): anon can read but not write `societies`; a society account cannot write; `reis_admin` can; `id` cannot change; FK aborts on an orphan; storage policies.
- UI: `verify-ui` at 320/390/430 and tablet width for the Societies panel on both admin variants, and before/after screenshots.

**Verification gap:** proving the real upload and insert end to end needs
`REIS_ADMIN_EMAIL`/`REIS_ADMIN_PASSWORD` in `.env`, which are missing. Without
them the write path is proven only against the local stub, and the PR says so.
`npm run dev:web` routes writes to an in-memory store and is not evidence.
