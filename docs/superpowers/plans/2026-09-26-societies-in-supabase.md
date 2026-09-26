# Societies in Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reIS admin adds, edits or hides a student society (with its logo) from the admin console, with no code change or release.

**Architecture:** A public-read `societies` table plus a `society-logos` storage bucket, both writable only by `reis_admin`. The client keeps the catalog in a new Zustand slice: seeded from a bundled copy, cached in IndexedDB, and refetched with every events load and on native resume. Every consumer resolves a society through that slice, and an unknown id resolves to a neutral grey society, never ESN.

**Tech Stack:** Supabase (Postgres RLS, Storage), supabase-js, React 19, Zustand slices, IndexedDBService, vitest + Testing Library, DaisyUI/Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-26-societies-in-supabase-design.md`. Read it, **including the "Amendments from planning" section at the end**, which overrides the lines it names.

## Global Constraints

- Society id format: `^[a-z0-9][a-z0-9_-]*$`, the same rule as `supabase/functions/society-accounts/password.ts`. Ids are immutable.
- `faculty_key` ∈ `mendelu, pef, af, ldf, zf, frrms` (the `FacultyKey` type in `src/types/events.ts`).
- Logos: PNG only from the client, 256×256, at most 256 KB. The object path is `<id>/<first 32 hex of sha256>.png`. SVG is never accepted.
- Pin colour: `#rrggbb` with contrast ≥ 2:1 against `#ffffff`.
- Writes to `societies` and `society-logos` require `get_my_role() = 'reis_admin'`. There is no delete policy on `societies`: hiding sets `is_active = false`.
- Repo rules (CLAUDE.md): no `localStorage`, no re-export barrels for new code, no `useEffect` data fetching, DaisyUI classes only, at most ~200 lines per file, test first.
- Local runs: the touched tests via `npx vitest run <pattern>` and `npm run typecheck`. Leave repo-wide lint, format and the full suite to CI. If vitest workers time out under load, add `--no-file-parallelism --maxWorkers=1`.
- Never `npx supabase db push`. Nothing in this plan applies SQL to production. Task 9 writes the runbook for Dominik to approve and run.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260926120000_societies_catalog.sql` | new | table, RLS, guard trigger, seed rows, FK, bucket + storage policies |
| `docs/verify-societies-catalog.md` | new | local stub recipe + claims table for the SQL |
| `src/types/events.ts` | modify | extend `Society` |
| `src/data/societies.ts` | rewrite | `BUNDLED_SOCIETIES` only |
| `src/utils/societies/resolveSociety.ts` | new | `glyphFor`, `neutralSociety`, `resolveSociety`, `listedSocieties`, `autoFollowSocietyFor`, `toSocietyRecord` |
| `src/utils/societies/pinColor.ts` | new | `isUsablePinColor` |
| `src/utils/readableTextColor.ts` | modify | export `contrastRatio` |
| `src/api/societies.ts` | new | public read, `rowToSociety`, `logoPublicUrl` |
| `src/api/societiesAdmin.ts` | new | admin writes: logo upload/remove, insert/update |
| `src/utils/societies/encodeSocietyLogo.ts` | new | square crop → 256 PNG |
| `src/store/slices/createSocietiesSlice.ts` | new | catalog state, cache, load, save, hide |
| `src/store/useAppStore.ts`, `src/store/types.ts` | modify | register slice |
| `src/api/mapEvents.ts`, `src/store/slices/createMapSlice.ts` | modify | catalog passed into mapping; load in parallel |
| `capacitor/startApp.ts` | modify | refresh catalog on resume |
| `src/hooks/useSociety.ts` | new | `useSociety`, `useListedSocieties` |
| `src/components/SocietyLogo.tsx` | new | logo with glyph-tile fallback |
| consumers | modify | EventDetailCard, EventLayer, AdminConsoleHeader, SocietyPicker, SocietyChip, NotificationItem, lessonPlace + 3 callers, eventAudience + ComposerAudienceField, SpolkySection, useSpolkySettings |
| `src/services/spolky/config.ts`, `types.ts`, `index.ts`, `spolkyService.ts` | modify | delete `ASSOCIATION_PROFILES`, `FACULTY_TO_ASSOCIATION`, `AssociationProfile`, `FacultyId`, `getUserAssociation` |
| `src/components/AdminConsole/SocietiesPanel.tsx` | new | list + hide/show + open form |
| `src/components/AdminConsole/SocietyForm.tsx` | new | add/edit form |
| `src/components/AdminConsole/SocietyAccountsPanel.tsx` | modify | catalog from the store |
| `src/components/AdminConsole/AdminConsole.tsx`, `MobileAdminConsole.tsx` | modify | mount `SocietiesPanel` |
| `src/i18n/locales/{cs,en}.json` | modify | new `admin.societies.*` keys |
| `privacy/disclosures.ts`, `src/test/guards/noStudentDataLeaves.test.ts` | modify | declare the new Supabase caller |
| `scripts/society-logos/*` | moved from `public/spolky/` | seed sources, not shipped |
| `scripts/seed-society-logos.ts` | new | rasterize + upload + print SQL |
| `docs/runbooks/societies-catalog-rollout.md` | new | hand-run order for prod |

---

### Task 1: Migration and local SQL verification

**Files:**
- Create: `supabase/migrations/20260926120000_societies_catalog.sql`
- Create: `docs/verify-societies-catalog.md`

**Interfaces:**
- Produces: table `public.societies` with columns `id, name, short_name, color, faculty_key, auto_follow_faculty, audience_label, logo_path, sort_order, is_active, updated_at`; bucket `society-logos`. Tasks 3 and 7 select and write exactly these names.

- [ ] **Step 1: Write the migration**

```sql
-- Societies catalog: who the student societies are, and their logos.
--
-- Until now a society existed only in the client's compiled catalog
-- (src/data/societies.ts + src/services/spolky/config.ts) and its logo shipped
-- in public/spolky/, so adding one was a code change and a store release. This
-- table and the society-logos bucket make it data a reIS admin edits in the
-- admin console. Spec: docs/superpowers/specs/2026-09-26-societies-in-supabase-design.md
--
-- Creates new objects only, apart from ONE contact with existing schema: the
-- foreign key from spolky_accounts.association_id. An old client build against
-- this database is unaffected.
--
-- APPLY BY HAND (no CI applies migrations):
--   npx supabase db query --linked -f supabase/migrations/20260926120000_societies_catalog.sql

begin;

create table public.societies (
  id                  text primary key check (id ~ '^[a-z0-9][a-z0-9_-]*$'),
  name                text not null check (length(btrim(name)) between 1 and 80),
  short_name          text not null check (length(btrim(short_name)) between 1 and 24),
  color               text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  faculty_key         text not null check (faculty_key in ('mendelu','pef','af','ldf','zf','frrms')),
  auto_follow_faculty boolean not null default false,
  audience_label      text check (audience_label in ('erasmus')),
  logo_path           text check (logo_path is null or logo_path ~ ('^' || id || '/[0-9a-f]{32}\.png$')),
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  updated_at          timestamptz not null default now()
);

-- One default society per faculty: first-run auto-follow picks exactly one.
create unique index societies_one_auto_follow_per_faculty
  on public.societies (faculty_key) where auto_follow_faculty;

-- The id is the society's LOGIN (<id>@societies.invalid) and what RLS matches
-- posts against. Renaming it is a four-table operation
-- (20260915120000_rename_af_society_to_usaf.sql), never an edit here.
create function public.societies_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id <> old.id then
    raise exception 'societies.id is immutable: it is the society login';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger societies_guard before update on public.societies
  for each row execute function public.societies_guard();

alter table public.societies enable row level security;

-- Supabase's default privileges hand anon full CRUD and TRUNCATE on a new
-- table. Take everything back, then grant only what the policies below use.
revoke all on public.societies from anon, authenticated;
grant select on public.societies to anon, authenticated;
grant insert, update on public.societies to authenticated;

create policy societies_public_read on public.societies
  for select to anon, authenticated using (true);
create policy societies_admin_insert on public.societies
  for insert to authenticated with check (public.get_my_role() = 'reis_admin');
create policy societies_admin_update on public.societies
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

-- Today's catalog, verbatim from src/data/societies.ts and spolky/config.ts.
-- logo_path stays null until scripts/seed-society-logos.ts uploads the files.
insert into public.societies
  (id, name, short_name, color, faculty_key, auto_follow_faculty, audience_label, sort_order)
values
  ('esn',      'ESN MENDELU', 'ESN',      '#00AEEF', 'mendelu', false, 'erasmus', 10),
  ('supef',    'SU PEF',      'SUPEF',    '#0046a0', 'pef',     true,  null,      20),
  ('au_frrms', 'AU FRRMS',    'AU FRRMS', '#c32897', 'frrms',   true,  null,      30),
  ('usaf',     'USAF',        'USAF',     '#c87800', 'af',      true,  null,      40),
  ('ldf',      'LDF Spolek',  'LDF',      '#0a5028', 'ldf',     true,  null,      50),
  ('zf',       'ZF Spolek',   'ZF',       '#8c0a00', 'zf',      true,  null,      60),
  ('ey',       'EY',          'EY',       '#2E2E38', 'pef',     false, null,      70),
  ('reis',     'reIS',        'reIS',     '#79be15', 'mendelu', false, null,      80);

-- Every account must name a society that exists. Checked, not assumed:
-- verified 2026-09-26 that prod holds exactly the eight ids above.
do $$
declare orphans text;
begin
  select string_agg(a.association_id, ', ') into orphans
    from public.spolky_accounts a
   where not exists (select 1 from public.societies s where s.id = a.association_id);
  if orphans is not null then
    raise exception 'aborting: spolky_accounts rows with no society: %', orphans;
  end if;
end $$;

alter table public.spolky_accounts
  add constraint spolky_accounts_association_id_fkey
  foreign key (association_id) references public.societies (id)
  on update restrict on delete restrict;

-- spolky_events deliberately gets NO foreign key: posts outlive accounts
-- (see the USAF migration) and must keep resolving.

-- Logos. Public bucket: <img> reads the public URL, no select policy needed for
-- students. PNG only. An SVG opened directly on the Supabase origin can run script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('society-logos', 'society-logos', true, 262144, array['image/png'])
on conflict (id) do nothing;

create policy society_logos_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy society_logos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy society_logos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin')
  with check (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy society_logos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');

commit;
```

- [ ] **Step 2: Start a stub Postgres**

Recipe from memory `verify-supabase-sql-locally`: history cannot replay, so hand-create only what the migration touches.

```bash
docker run -d --name reis-societies-sql -e POSTGRES_PASSWORD=pw -p 55434:5432 postgres:15
```

Wait until `docker exec reis-societies-sql pg_isready -U postgres` prints `accepting connections`.

- [ ] **Step 3: Create the prerequisite objects**

Save as `$SCRATCH/societies-prereq.sql`, where `$SCRATCH` is the session scratchpad:

```sql
create role anon nologin; create role authenticated nologin;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text, name text);
alter table storage.objects enable row level security;
create table public.spolky_accounts (association_id text, role text, user_id uuid, is_active boolean default true);
insert into public.spolky_accounts values
  ('esn','association',gen_random_uuid()),('supef','association',gen_random_uuid()),
  ('au_frrms','association',gen_random_uuid()),('usaf','association',gen_random_uuid()),
  ('ldf','association',gen_random_uuid()),('zf','association',gen_random_uuid()),
  ('ey','association',gen_random_uuid()),('reis','reis_admin',gen_random_uuid());
-- get_my_role() stub driven by a session setting, so each check can pick a role.
create function public.get_my_role() returns text language sql stable as
  $$ select nullif(current_setting('test.role', true), '') $$;
grant usage on schema public, storage to anon, authenticated;
grant execute on function public.get_my_role() to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
```

Apply it, then the migration:

```bash
docker exec -i reis-societies-sql psql -U postgres -v ON_ERROR_STOP=1 < "$SCRATCH/societies-prereq.sql"
docker exec -i reis-societies-sql psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260926120000_societies_catalog.sql
```

Expected: `COMMIT`, no `ERROR`.

- [ ] **Step 4: Exercise every claim**

Save as `$SCRATCH/societies-claims.sql`. Each block raises `FAIL:` if a claim breaks. `set_config(..., false)` is session-wide on purpose: the transaction-local form is lost between psql statements.

```sql
\set ON_ERROR_STOP 1
-- 1. anon reads all eight rows
set role anon;
do $$ begin if (select count(*) from public.societies) <> 8 then raise exception 'FAIL: anon read'; end if; end $$;
-- 2. anon cannot insert
do $$ begin
  insert into public.societies (id,name,short_name,color,faculty_key) values ('x','X','X','#000000','pef');
  raise exception 'FAIL: anon insert allowed';
exception when insufficient_privilege then null; end $$;
reset role;
-- 3. a society account cannot insert or update
select set_config('test.role', 'association', false);
set role authenticated;
do $$ begin
  insert into public.societies (id,name,short_name,color,faculty_key) values ('x','X','X','#000000','pef');
  raise exception 'FAIL: association insert allowed';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  update public.societies set name = 'Hacked' where id = 'esn';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: association update touched % rows', n; end if;
end $$;
reset role;
-- 4. reis_admin can insert and update
select set_config('test.role', 'reis_admin', false);
set role authenticated;
insert into public.societies (id,name,short_name,color,faculty_key) values ('newsoc','New','NEW','#123456','zf');
update public.societies set name = 'Newer' where id = 'newsoc';
-- 5. the id cannot change
do $$ begin
  update public.societies set id = 'renamed' where id = 'newsoc';
  raise exception 'FAIL: id changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
-- 6. only one auto-follow society per faculty
do $$ begin
  update public.societies set auto_follow_faculty = true where id = 'ey';
  raise exception 'FAIL: second PEF auto-follow allowed';
exception when unique_violation then null; end $$;
-- 7. a logo_path must sit under its own id
do $$ begin
  update public.societies set logo_path = 'esn/0123456789abcdef0123456789abcdef.png' where id = 'newsoc';
  raise exception 'FAIL: foreign logo path allowed';
exception when check_violation then null; end $$;
update public.societies set logo_path = 'newsoc/0123456789abcdef0123456789abcdef.png' where id = 'newsoc';
reset role;
-- 8. the FK rejects an account for a missing society
do $$ begin
  insert into public.spolky_accounts values ('ghost','association',gen_random_uuid());
  raise exception 'FAIL: orphan account allowed';
exception when foreign_key_violation then null; end $$;
-- 9. storage: association cannot write logos, reis_admin can
select set_config('test.role', 'association', false);
set role authenticated;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('society-logos', 'esn/a.png');
  raise exception 'FAIL: association logo upload allowed';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('test.role', 'reis_admin', false);
set role authenticated;
insert into storage.objects (bucket_id, name) values ('society-logos', 'esn/a.png');
delete from storage.objects where name = 'esn/a.png';
reset role;
-- 10. anon has no TRUNCATE
do $$ begin
  if has_table_privilege('anon', 'public.societies', 'TRUNCATE') then raise exception 'FAIL: anon truncate'; end if;
end $$;
select 'ALL CLAIMS HOLD';
```

Run: `docker exec -i reis-societies-sql psql -U postgres < "$SCRATCH/societies-claims.sql"`
Expected: the last line prints `ALL CLAIMS HOLD`, with no `FAIL:`. If a claim fails, fix the migration, then `docker rm -f reis-societies-sql` and repeat from Step 2.

Note on claim 3: PostgreSQL raises `insufficient_privilege` for a failed RLS `with check` on insert. An update that no policy allows touches 0 rows instead of erroring. That is why the two are checked differently.

- [ ] **Step 5: Record the recipe**

Write `docs/verify-societies-catalog.md`: the commands from Steps 2–4 (point to the two SQL files by content, inlined), a table of the ten claims with "held" and the date, and one line saying the migration is not applied and the runbook in Task 9 owns that. Then `docker rm -f reis-societies-sql`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260926120000_societies_catalog.sql docs/verify-societies-catalog.md
git commit -m "feat(societies): societies table and logo bucket, admin-writable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Society model, bundled seed, resolution helpers, colour rule

**Files:**
- Modify: `src/types/events.ts:66-78` (the `Society` interface)
- Rewrite: `src/data/societies.ts`
- Create: `src/utils/societies/resolveSociety.ts`
- Create: `src/utils/societies/pinColor.ts`
- Modify: `src/utils/readableTextColor.ts`
- Rewrite test: `src/data/__tests__/societies.test.ts`
- Create test: `src/utils/societies/__tests__/resolveSociety.test.ts`
- Create test: `src/utils/societies/__tests__/pinColor.test.ts`

**Interfaces:**
- Produces:
  - `interface Society { id; name; shortName; color; glyph; logo?: string; facultyKey: FacultyKey; autoFollowFaculty: boolean; audienceLabel: 'erasmus' | null; sortOrder: number; isActive: boolean }`
  - `BUNDLED_SOCIETIES: Record<string, Society>`
  - `glyphFor(shortName: string): string`
  - `NEUTRAL_SOCIETY_COLOR = '#6b7280'`
  - `neutralSociety(id: string): Society`
  - `resolveSociety(catalog: Record<string, Society>, id: string): Society`
  - `listedSocieties(catalog): Society[]` (active, sorted by `sortOrder`, then `name`)
  - `autoFollowSocietyFor(catalog, facultyKey: FacultyKey): string | null`
  - `toSocietyRecord(list: Society[]): Record<string, Society>`
  - `contrastRatio(a: string, b: string): number`
  - `MIN_PIN_CONTRAST = 2`
  - `isUsablePinColor(hex: string): boolean`

`societyById`, `SOCIETIES` and `ALL_SOCIETIES` are removed. **After this task the app does not compile until Task 5 migrates the consumers.** So Tasks 2–6 land as one reviewed batch: commit per task, and run `npm run typecheck` green only at the end of Task 6.

- [ ] **Step 1: Write the failing tests**

`src/utils/societies/__tests__/resolveSociety.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  glyphFor,
  neutralSociety,
  resolveSociety,
  listedSocieties,
  autoFollowSocietyFor,
  toSocietyRecord,
  NEUTRAL_SOCIETY_COLOR,
} from '../resolveSociety';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

describe('glyphFor', () => {
  it('keeps a short name of up to four characters as-is', () => {
    expect(glyphFor('USAF')).toBe('USAF');
    expect(glyphFor('reIS')).toBe('reIS');
    expect(glyphFor('EY')).toBe('EY');
  });
  it('uses the first word when the name is long', () => {
    expect(glyphFor('AU FRRMS')).toBe('AU');
  });
  it('takes two capitals when even the first word is long', () => {
    expect(glyphFor('SUPEF')).toBe('SU');
  });
});

describe('resolveSociety', () => {
  it('returns the catalog entry', () => {
    expect(resolveSociety(BUNDLED_SOCIETIES, 'supef').shortName).toBe('SUPEF');
  });
  it('never falls back to ESN for an unknown id', () => {
    const soc = resolveSociety(BUNDLED_SOCIETIES, 'brand-new');
    expect(soc.id).toBe('brand-new');
    expect(soc.color).toBe(NEUTRAL_SOCIETY_COLOR);
    expect(soc.logo).toBeUndefined();
    expect(soc.facultyKey).toBe('mendelu');
  });
  it('builds the neutral glyph from the id', () => {
    expect(neutralSociety('kino').glyph).toBe('kino');
  });
});

describe('listedSocieties', () => {
  it('drops hidden societies and sorts by sortOrder', () => {
    const catalog = toSocietyRecord([
      { ...BUNDLED_SOCIETIES.zf!, sortOrder: 1 },
      { ...BUNDLED_SOCIETIES.esn!, sortOrder: 2 },
      { ...BUNDLED_SOCIETIES.ey!, isActive: false },
    ]);
    expect(listedSocieties(catalog).map((s) => s.id)).toEqual(['zf', 'esn']);
  });
});

describe('autoFollowSocietyFor', () => {
  it('finds the default society for a faculty and ignores others filed under it', () => {
    expect(autoFollowSocietyFor(BUNDLED_SOCIETIES, 'pef')).toBe('supef'); // not 'ey'
  });
  it('returns null for mendelu-wide', () => {
    expect(autoFollowSocietyFor(BUNDLED_SOCIETIES, 'mendelu')).toBeNull();
  });
  it('skips a hidden default', () => {
    const catalog = { ...BUNDLED_SOCIETIES, zf: { ...BUNDLED_SOCIETIES.zf!, isActive: false } };
    expect(autoFollowSocietyFor(catalog, 'zf')).toBeNull();
  });
});
```

`src/utils/societies/__tests__/pinColor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isUsablePinColor } from '../pinColor';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

describe('isUsablePinColor', () => {
  it('accepts every colour already in the catalog', () => {
    for (const s of Object.values(BUNDLED_SOCIETIES)) expect(isUsablePinColor(s.color)).toBe(true);
  });
  it('rejects EY yellow and near-white on the light basemap', () => {
    expect(isUsablePinColor('#FFE600')).toBe(false);
    expect(isUsablePinColor('#f5f5f5')).toBe(false);
  });
  it('rejects anything that is not #rrggbb', () => {
    expect(isUsablePinColor('red')).toBe(false);
    expect(isUsablePinColor('#fff')).toBe(false);
  });
});
```

Replace `src/data/__tests__/societies.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { BUNDLED_SOCIETIES } from '../societies';

// The bundled seed is what a first-ever launch shows before the catalog
// arrives. It must match the migration's seed rows, or a student sees one
// branding for a second and another after the fetch.
describe('BUNDLED_SOCIETIES', () => {
  it('holds the eight seeded societies', () => {
    expect(Object.keys(BUNDLED_SOCIETIES).sort()).toEqual(
      ['au_frrms', 'esn', 'ey', 'ldf', 'reis', 'supef', 'usaf', 'zf']
    );
  });
  it('carries no logo URLs: they exist only after the prod seed', () => {
    for (const s of Object.values(BUNDLED_SOCIETIES)) expect(s.logo).toBeUndefined();
  });
  it('has exactly one auto-follow society per faculty', () => {
    const auto = Object.values(BUNDLED_SOCIETIES).filter((s) => s.autoFollowFaculty);
    expect(auto.map((s) => s.facultyKey).sort()).toEqual(['af', 'frrms', 'ldf', 'pef', 'zf']);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/utils/societies src/data/__tests__/societies.test.ts`
Expected: FAIL, because the modules and exports don't exist yet.

- [ ] **Step 3: Implement**

`src/types/events.ts`: replace the `Society` interface (lines 66–78) with:

```ts
export interface Society {
  id: string;
  name: string;
  /** Short label for compact UI (host line, chips): "SUPEF" vs "SU PEF". */
  shortName: string;
  color: string;
  /** Text shown on the colour tile when there is no logo, derived from shortName. */
  glyph: string;
  /** Public URL of the logo in the society-logos bucket. Absent until one is
   *  uploaded, and in the bundled seed; every call site falls back to `glyph`. */
  logo?: string;
  facultyKey: FacultyKey;
  /** New students of `facultyKey` follow this society on first run. */
  autoFollowFaculty: boolean;
  /** Who the society is for when no faculty says it (ESN: the Erasmus students). */
  audienceLabel: 'erasmus' | null;
  sortOrder: number;
  /** Hidden societies still resolve for their old events; they leave lists. */
  isActive: boolean;
}
```

`src/utils/societies/resolveSociety.ts`:

```ts
import type { FacultyKey, Society } from '../../types/events';

export const NEUTRAL_SOCIETY_COLOR = '#6b7280';

/** Tile text for a society without a logo: short names whole, long ones abbreviated. */
export function glyphFor(shortName: string): string {
  const trimmed = shortName.trim();
  if (trimmed.length <= 4) return trimmed;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.length <= 4 ? first : first.slice(0, 2).toUpperCase();
}

/**
 * What an id the catalog does not know renders as. Grey, no logo, campus-wide.
 *
 * It used to be ESN. With a catalog that arrives over the network, a cache
 * older than a newly added society is normal, and falling back to ESN would
 * brand that society's events as somebody else's.
 */
export function neutralSociety(id: string): Society {
  return {
    id,
    name: id,
    shortName: id,
    color: NEUTRAL_SOCIETY_COLOR,
    glyph: glyphFor(id),
    facultyKey: 'mendelu',
    autoFollowFaculty: false,
    audienceLabel: null,
    sortOrder: Number.MAX_SAFE_INTEGER,
    isActive: false,
  };
}

export function resolveSociety(catalog: Record<string, Society>, id: string): Society {
  return catalog[id] ?? neutralSociety(id);
}

/** The societies a student or admin can pick from: active, in catalog order. */
export function listedSocieties(catalog: Record<string, Society>): Society[] {
  return Object.values(catalog)
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** The society new students of this faculty follow by default, if any. */
export function autoFollowSocietyFor(
  catalog: Record<string, Society>,
  facultyKey: FacultyKey
): string | null {
  const hit = Object.values(catalog).find(
    (s) => s.isActive && s.autoFollowFaculty && s.facultyKey === facultyKey
  );
  return hit?.id ?? null;
}

export function toSocietyRecord(list: Society[]): Record<string, Society> {
  return Object.fromEntries(list.map((s) => [s.id, s]));
}
```

`src/data/societies.ts` (full replacement):

```ts
import type { Society } from '../types/events';

// The catalog a first-ever launch starts from, before the societies table
// (supabase/migrations/20260926120000_societies_catalog.sql) has been fetched.
// It must match that migration's seed rows. After the first fetch the cached
// catalog replaces it, so editing a society here changes nothing for students:
// edit it in the admin console instead.
//
// No logos on purpose: logo URLs are content-hashed storage paths that exist
// only once scripts/seed-society-logos.ts has run against prod. Until the first
// fetch the glyph tile shows, which is what every logo slot falls back to.
const seed = (s: Omit<Society, 'isActive'>): Society => ({ ...s, isActive: true });

export const BUNDLED_SOCIETIES: Record<string, Society> = {
  esn: seed({ id: 'esn', name: 'ESN MENDELU', shortName: 'ESN', color: '#00AEEF', glyph: 'ESN', facultyKey: 'mendelu', autoFollowFaculty: false, audienceLabel: 'erasmus', sortOrder: 10 }),
  supef: seed({ id: 'supef', name: 'SU PEF', shortName: 'SUPEF', color: '#0046a0', glyph: 'SU', facultyKey: 'pef', autoFollowFaculty: true, audienceLabel: null, sortOrder: 20 }),
  au_frrms: seed({ id: 'au_frrms', name: 'AU FRRMS', shortName: 'AU FRRMS', color: '#c32897', glyph: 'AU', facultyKey: 'frrms', autoFollowFaculty: true, audienceLabel: null, sortOrder: 30 }),
  usaf: seed({ id: 'usaf', name: 'USAF', shortName: 'USAF', color: '#c87800', glyph: 'USAF', facultyKey: 'af', autoFollowFaculty: true, audienceLabel: null, sortOrder: 40 }),
  ldf: seed({ id: 'ldf', name: 'LDF Spolek', shortName: 'LDF', color: '#0a5028', glyph: 'LDF', facultyKey: 'ldf', autoFollowFaculty: true, audienceLabel: null, sortOrder: 50 }),
  zf: seed({ id: 'zf', name: 'ZF Spolek', shortName: 'ZF', color: '#8c0a00', glyph: 'ZF', facultyKey: 'zf', autoFollowFaculty: true, audienceLabel: null, sortOrder: 60 }),
  ey: seed({ id: 'ey', name: 'EY', shortName: 'EY', color: '#2E2E38', glyph: 'EY', facultyKey: 'pef', autoFollowFaculty: false, audienceLabel: null, sortOrder: 70 }),
  reis: seed({ id: 'reis', name: 'reIS', shortName: 'reIS', color: '#79be15', glyph: 'reIS', facultyKey: 'mendelu', autoFollowFaculty: false, audienceLabel: null, sortOrder: 80 }),
};
```

Prettier will reflow those long lines. That is expected.

`src/utils/readableTextColor.ts`: add below `luminance`:

```ts
/** WCAG contrast ratio between two #rrggbb colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
```

`src/utils/societies/pinColor.ts`:

```ts
import { contrastRatio } from '../readableTextColor';

/**
 * The pin must stay visible on the campus basemap, which is always light.
 *
 * 2:1, not WCAG's 3:1 for graphics: 3:1 rejects ESN's own cyan (2.5:1), which
 * has been on the map since launch and reads fine with the pin's outline. 2:1
 * still rejects what actually disappears: EY's yellow (1.3:1), and near-whites.
 */
export const MIN_PIN_CONTRAST = 2;

export function isUsablePinColor(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  return contrastRatio(hex, '#ffffff') >= MIN_PIN_CONTRAST;
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/utils/societies src/data/__tests__/societies.test.ts src/utils/__tests__/readableTextColor`
Expected: PASS. If there is no readableTextColor test file, the pattern just matches nothing.

- [ ] **Step 5: Commit**

```bash
git add src/types/events.ts src/data src/utils/societies src/utils/readableTextColor.ts
git commit -m "feat(societies): society model, bundled seed, neutral fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Public catalog read + privacy declarations

**Files:**
- Create: `src/api/societies.ts`
- Create test: `src/api/__tests__/societies.test.ts`
- Modify: `src/test/guards/noStudentDataLeaves.test.ts` (the `SUPABASE_CALLERS` set, after `'src/api/mapEvents.ts'`)
- Modify: `privacy/disclosures.ts` (the `EXEMPT` array)

**Interfaces:**
- Consumes: `Society`, `glyphFor` (Task 2)
- Produces:
  - `SOCIETY_LOGO_BUCKET = 'society-logos'`
  - `interface SocietyRow { id; name; short_name; color; faculty_key; auto_follow_faculty; audience_label; logo_path; sort_order; is_active }`
  - `logoPublicUrl(path: string): string`
  - `rowToSociety(row: SocietyRow): Society | null`
  - `fetchSocieties(): Promise<Society[] | null>`, which returns null on error

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { from: () => ({ select: () => ({ order }) }) },
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { rowToSociety, fetchSocieties, logoPublicUrl, type SocietyRow } from '../societies';

const row: SocietyRow = {
  id: 'supef', name: 'SU PEF', short_name: 'SUPEF', color: '#0046a0', faculty_key: 'pef',
  auto_follow_faculty: true, audience_label: null,
  logo_path: 'supef/0123456789abcdef0123456789abcdef.png', sort_order: 20, is_active: true,
};

beforeEach(() => order.mockReset());

describe('rowToSociety', () => {
  it('maps a row, building the public logo URL and the glyph', () => {
    expect(rowToSociety(row)).toEqual({
      id: 'supef', name: 'SU PEF', shortName: 'SUPEF', color: '#0046a0', glyph: 'SU',
      logo: logoPublicUrl('supef/0123456789abcdef0123456789abcdef.png'),
      facultyKey: 'pef', autoFollowFaculty: true, audienceLabel: null, sortOrder: 20, isActive: true,
    });
  });
  it('leaves logo undefined when there is no path', () => {
    expect(rowToSociety({ ...row, logo_path: null })!.logo).toBeUndefined();
  });
  it('drops a row whose faculty the client does not know', () => {
    expect(rowToSociety({ ...row, faculty_key: 'xyz' })).toBeNull();
  });
});

describe('logoPublicUrl', () => {
  it('points at the public object endpoint of the society-logos bucket', () => {
    expect(logoPublicUrl('esn/ab.png')).toMatch(
      /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/society-logos\/esn\/ab\.png$/
    );
  });
});

describe('fetchSocieties', () => {
  it('returns null on error so the caller keeps what it has', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchSocieties()).toBeNull();
  });
  it('maps and filters rows', async () => {
    order.mockResolvedValue({ data: [row, { ...row, id: 'bad', faculty_key: '??' }], error: null });
    expect((await fetchSocieties())!.map((s) => s.id)).toEqual(['supef']);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/api/__tests__/societies.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement `src/api/societies.ts`**

```ts
import { supabase } from '../services/spolky/supabaseClient';
import { SUPABASE_URL } from '../services/supabase/config';
import { ORGANIZERS, type FacultyKey, type Society } from '../types/events';
import { glyphFor } from '../utils/societies/resolveSociety';
import { logError } from '../utils/reportError';

export const SOCIETY_LOGO_BUCKET = 'society-logos';

export interface SocietyRow {
  id: string;
  name: string;
  short_name: string;
  color: string;
  faculty_key: string;
  auto_follow_faculty: boolean;
  audience_label: string | null;
  logo_path: string | null;
  sort_order: number;
  is_active: boolean;
}

export const SOCIETY_COLUMNS =
  'id, name, short_name, color, faculty_key, auto_follow_faculty, audience_label, logo_path, sort_order, is_active';

export function logoPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SOCIETY_LOGO_BUCKET}/${path}`;
}

function isFacultyKey(value: string): value is FacultyKey {
  return value in ORGANIZERS;
}

/** Null for a row this client cannot place: a faculty added after this build. */
export function rowToSociety(row: SocietyRow): Society | null {
  if (!isFacultyKey(row.faculty_key)) return null;
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    color: row.color,
    glyph: glyphFor(row.short_name),
    ...(row.logo_path ? { logo: logoPublicUrl(row.logo_path) } : {}),
    facultyKey: row.faculty_key,
    autoFollowFaculty: row.auto_follow_faculty,
    audienceLabel: row.audience_label === 'erasmus' ? 'erasmus' : null,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

/**
 * The whole catalog, hidden societies included: an old event still needs its
 * society's name. Anonymous read of public branding, with no identity and no
 * student data in either direction.
 */
export async function fetchSocieties(): Promise<Society[] | null> {
  const { data, error } = await supabase
    .from('societies')
    .select(SOCIETY_COLUMNS)
    .order('sort_order', { ascending: true });
  if (error) {
    logError('Api.fetchSocieties', error);
    return null;
  }
  return ((data ?? []) as SocietyRow[])
    .map(rowToSociety)
    .filter((s): s is Society => s !== null);
}
```

The `...(cond ? {logo} : {})` spread is there because `toEqual` treats `logo: undefined` and a missing key alike, but `exactOptionalPropertyTypes` (if enabled) does not. Check `tsconfig` and keep the spread either way.

- [ ] **Step 4: Declare the caller**

In `src/test/guards/noStudentDataLeaves.test.ts`, add after the `'src/api/mapEvents.ts',` line:

```ts
  // The societies catalog (September 2026): an anonymous select of public
  // branding (name, colour, faculty, logo path). No identity, no student data,
  // nothing written. Logos then load as plain <img> GETs from the same project.
  'src/api/societies.ts',
```

In `privacy/disclosures.ts`, add to `EXEMPT` after the `spolky_events` entry:

```ts
  {
    call: 'societies',
    files: ['src/api/societies.ts', 'src/api/societiesAdmin.ts'],
    why: 'Public society catalog read (names, colours, logo paths); writes are by a signed-in reis_admin, not a student.',
  },
```

`src/api/societiesAdmin.ts` is created in Task 7. If the disclosure checker fails on a missing file before then, add that path in Task 7 instead.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/api/__tests__/societies.test.ts src/test/guards/noStudentDataLeaves.test.ts scripts/lib/__tests__/privacyDisclosures.test.ts`
Expected: PASS. Then `npm run privacy:generate` and commit what it regenerates, if anything.

- [ ] **Step 6: Commit**

```bash
git add src/api/societies.ts src/api/__tests__/societies.test.ts src/test/guards/noStudentDataLeaves.test.ts privacy docs
git commit -m "feat(societies): read the catalog from Supabase, declared as a public read

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Societies slice, loaded with the events, refreshed on resume

**Files:**
- Create: `src/store/slices/createSocietiesSlice.ts`
- Create test: `src/store/slices/__tests__/createSocietiesSlice.test.ts`
- Modify: `src/store/types.ts:669-677` (add the slice to `AppState`)
- Modify: `src/store/useAppStore.ts` (import and spread `createSocietiesSlice`)
- Modify: `src/api/mapEvents.ts` (`toMapEvent(row, societies)`, `fetchMapEvents(societies)`)
- Modify: `src/store/slices/createMapSlice.ts:227` and `:293-305`
- Modify: `capacitor/startApp.ts:119-121`
- Modify tests: `src/api/__tests__/mapEvents.test.ts`, `src/api/__tests__/mapEvents.production.test.ts`, `src/store/slices/__tests__/createMapSlice.test.ts`

**Interfaces:**
- Consumes: `fetchSocieties` (Task 3), `BUNDLED_SOCIETIES`, `toSocietyRecord`, `resolveSociety` (Task 2)
- Produces (on `AppState`):
  - `societies: Record<string, Society>`
  - `societiesCacheRead: boolean`
  - `loadSocieties(): Promise<void>`
  - `putSociety(s: Society): Promise<void>`, which upserts locally and into the cache after an admin save
  - `toMapEvent(row: SpolkyEventRow, societies: Record<string, Society>): MapEvent`
  - `fetchMapEvents(societies: Record<string, Society>): Promise<MapEvent[]>`

- [ ] **Step 1: Write the failing slice test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';

const fetchSocieties = vi.fn();
vi.mock('../../../api/societies', () => ({ fetchSocieties: () => fetchSocieties() }));
const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));

import { createSocietiesSlice, type SocietiesSlice } from '../createSocietiesSlice';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

const makeStore = () =>
  create<SocietiesSlice>()((...a) => createSocietiesSlice(...(a as Parameters<typeof createSocietiesSlice>)));

const fresh = { ...BUNDLED_SOCIETIES.esn!, name: 'ESN (fresh)' };
const newcomer = { ...BUNDLED_SOCIETIES.zf!, id: 'kino', name: 'Kino' };

beforeEach(() => {
  idb.clear();
  fetchSocieties.mockReset();
});

describe('createSocietiesSlice', () => {
  it('starts from the bundled seed, so nothing is ever unbranded', () => {
    expect(makeStore().getState().societies.supef!.shortName).toBe('SUPEF');
  });

  it('replaces the seed with the fetched catalog and caches it', async () => {
    fetchSocieties.mockResolvedValue([fresh, newcomer]);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(Object.keys(store.getState().societies)).toEqual(['esn', 'kino']);
    expect(idb.get('societies_catalog')).toEqual([fresh, newcomer]);
  });

  it('reads the cache before the network, and keeps it when the fetch fails', async () => {
    idb.set('societies_catalog', [newcomer]);
    fetchSocieties.mockResolvedValue(null);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.kino!.name).toBe('Kino');
  });

  it('ignores an empty fetch rather than wiping the catalog', async () => {
    fetchSocieties.mockResolvedValue([]);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.supef).toBeDefined();
  });

  it('ignores a corrupt cache entry', async () => {
    idb.set('societies_catalog', [{ nope: true }]);
    fetchSocieties.mockResolvedValue(null);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.supef).toBeDefined();
  });

  it('putSociety upserts into state and cache', async () => {
    const store = makeStore();
    await store.getState().putSociety(newcomer);
    expect(store.getState().societies.kino).toEqual(newcomer);
    expect((idb.get('societies_catalog') as { id: string }[]).some((s) => s.id === 'kino')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/store/slices/__tests__/createSocietiesSlice.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement the slice**

```ts
import type { AppSlice } from '../types';
import type { Society } from '../../types/events';
import { fetchSocieties } from '../../api/societies';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { toSocietyRecord } from '../../utils/societies/resolveSociety';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

export const SOCIETIES_CACHE_KEY = 'societies_catalog';

export interface SocietiesSlice {
  /** Every society, hidden ones included. Never empty: starts as the bundled seed. */
  societies: Record<string, Society>;
  societiesCacheRead: boolean;
  /** Cache (once), then network. Called with every events load and on native resume. */
  loadSocieties: () => Promise<void>;
  /** After an admin save: show it now, without waiting for the next fetch. */
  putSociety: (society: Society) => Promise<void>;
}

function isSociety(value: unknown): value is Society {
  const s = value as Society;
  return (
    typeof s === 'object' && s !== null &&
    typeof s.id === 'string' && typeof s.name === 'string' &&
    typeof s.shortName === 'string' && typeof s.color === 'string' &&
    typeof s.facultyKey === 'string' && typeof s.isActive === 'boolean'
  );
}

export const createSocietiesSlice: AppSlice<SocietiesSlice> = (set, get) => ({
  societies: BUNDLED_SOCIETIES,
  societiesCacheRead: false,

  loadSocieties: async () => {
    if (!get().societiesCacheRead) {
      try {
        const cached: unknown = await IndexedDBService.get('meta', SOCIETIES_CACHE_KEY);
        if (Array.isArray(cached) && cached.length > 0 && cached.every(isSociety)) {
          set({ societies: toSocietyRecord(cached) });
        }
      } catch (err) {
        logError('SocietiesSlice.readCache', err);
      }
      set({ societiesCacheRead: true });
    }

    const fresh = await fetchSocieties();
    // null is a failed fetch; [] is a table this client cannot read (RLS,
    // an outage). Neither may wipe a catalog every screen depends on.
    if (!fresh || fresh.length === 0) return;
    set({ societies: toSocietyRecord(fresh) });
    try {
      await IndexedDBService.set('meta', SOCIETIES_CACHE_KEY, fresh);
    } catch (err) {
      logError('SocietiesSlice.writeCache', err);
    }
  },

  putSociety: async (society) => {
    const societies = { ...get().societies, [society.id]: society };
    set({ societies });
    try {
      await IndexedDBService.set('meta', SOCIETIES_CACHE_KEY, Object.values(societies));
    } catch (err) {
      logError('SocietiesSlice.writeCache', err);
    }
  },
});
```

`AppSlice` is typed against the full `AppState`, so the test's `create<SocietiesSlice>` needs the cast shown in Step 1. If TypeScript still objects, follow how an existing slice test builds its store (see `createAdminSlice.society.test.ts`, which uses the real `useAppStore`) and switch to that.

Register the slice:
- `src/store/types.ts`: add `import('./slices/createSocietiesSlice').SocietiesSlice &` to the `AppState` intersection, next to `RsvpSlice`.
- `src/store/useAppStore.ts`: `import { createSocietiesSlice } from './slices/createSocietiesSlice';` and `...createSocietiesSlice(...a),` next to `createMapSlice`.

- [ ] **Step 4: Run the slice test and see it pass**

Run: `npx vitest run src/store/slices/__tests__/createSocietiesSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Thread the catalog into event mapping**

`src/api/mapEvents.ts`:
- Replace `import { societyById } from '../data/societies';` with:
  - `import type { Society } from '../types/events';`
  - `import { resolveSociety } from '../utils/societies/resolveSociety';`
- `export function toMapEvent(row: SpolkyEventRow, societies: Record<string, Society>): MapEvent {`, whose first line becomes `const soc = resolveSociety(societies, row.association_id);`. Add a comment above `organizerKey`: `// Unread for map events (the map's faculty filter is gone); display resolves the society through useSociety.`
- `export async function fetchMapEvents(societies: Record<string, Society>): Promise<MapEvent[]>`, whose last line becomes `.map((row) => toMapEvent(row, societies));`

`src/store/slices/createMapSlice.ts`:
- line 227: `set({ societyMapEvents: rows.map((r) => locateEvent(toMapEvent(r, get().societies))) });`
- `reloadMapEvents`: replace `const events = await fetchMapEvents();` with:

```ts
      // The catalog is refetched beside every events load, in parallel, so an
      // event can never be newer than the catalog that names its society. The
      // mapping uses whatever catalog is in hand; display resolves reactively.
      const [events] = await Promise.all([
        fetchMapEvents(get().societies),
        get().loadSocieties(),
      ]);
```

`capacitor/startApp.ts`, inside the existing `resume` listener:

```ts
  void CapApp.addListener('resume', () => {
    void requestSync('resume');
    // Fetch-once-at-startup is stale forever in a long-lived Capacitor process.
    void useAppStore.getState().loadSocieties();
  });
```

Fix the tests the signature change broke:
- `src/api/__tests__/mapEvents.test.ts` and `mapEvents.production.test.ts`: `import { BUNDLED_SOCIETIES } from '../../data/societies';` and pass it as the second argument to every `toMapEvent(...)` / `fetchMapEvents()` call.
- `src/store/slices/__tests__/createMapSlice.test.ts`: `fetchMapEvents` is mocked, so only mock `loadSocieties` if the real one reaches the network. Check by running the test first.

- [ ] **Step 6: Run the touched tests**

Run: `npx vitest run src/api/__tests__/mapEvents src/store/slices/__tests__/createMapSlice src/store/slices/__tests__/createSocietiesSlice`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/store src/api/mapEvents.ts src/api/__tests__/mapEvents* capacitor/startApp.ts
git commit -m "feat(societies): catalog slice, loaded with events and on resume

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `SocietyLogo`, `useSociety`, and the display consumers

**Files:**
- Create: `src/hooks/useSociety.ts`
- Create: `src/components/SocietyLogo.tsx`
- Create test: `src/components/__tests__/SocietyLogo.test.tsx`
- Modify: `src/components/CampusMap/EventDetailCard.tsx:5,54,84-92`
- Modify: `src/components/CampusMap/EventLayer.tsx:12,81`
- Modify: `src/components/AdminConsole/AdminConsoleHeader.tsx:4,18`
- Modify: `src/components/AdminConsole/SocietyPicker.tsx`
- Modify: `src/components/AdminConsole/SocietyChip.tsx`
- Modify: `src/utils/lessonPlace.ts:8,50,75` plus callers `src/components/CalendarEventCard.tsx:79`, `src/components/mobile/screens/calendar/NowNextCard.tsx:12,20`, `src/components/mobile/screens/calendar/AgendaEvent.tsx:69`
- Modify test: `src/utils/__tests__/lessonPlace.test.ts` (pass `BUNDLED_SOCIETIES`)

**Interfaces:**
- Consumes: `societies` slice state (Task 4), `resolveSociety`, `listedSocieties` (Task 2), `readableTextColor`
- Produces:
  - `useSociety(id: string | null | undefined): Society | null`
  - `useListedSocieties(): Society[]`
  - `<SocietyLogo society={Society} className={string} fit?: 'cover' | 'contain' />`
  - `lessonPlace(lesson, language, events, onMapLabel, societies: Record<string, Society>)`

- [ ] **Step 1: Write the failing test**

`src/components/__tests__/SocietyLogo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SocietyLogo } from '../SocietyLogo';
import { BUNDLED_SOCIETIES } from '../../data/societies';

const withLogo = { ...BUNDLED_SOCIETIES.supef!, logo: 'https://x.supabase.co/l.png' };

describe('SocietyLogo', () => {
  it('shows the glyph tile when there is no logo', () => {
    render(<SocietyLogo society={BUNDLED_SOCIETIES.supef!} className="h-6 w-6" />);
    expect(screen.getByText('SU')).toBeInTheDocument();
  });

  it('shows the logo when there is one', () => {
    const { container } = render(<SocietyLogo society={withLogo} className="h-6 w-6" />);
    expect(container.querySelector('img')).toHaveAttribute('src', withLogo.logo);
  });

  it('falls back to the glyph tile when the logo fails to load', () => {
    const { container } = render(<SocietyLogo society={withLogo} className="h-6 w-6" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('SU')).toBeInTheDocument();
  });

  it('picks readable glyph ink on a light brand colour', () => {
    render(<SocietyLogo society={BUNDLED_SOCIETIES.esn!} className="h-6 w-6" />);
    // ESN cyan fails with white (2.5:1), so the tile uses dark ink.
    expect(screen.getByText('ESN').parentElement).toHaveStyle({ color: '#111827' });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/components/__tests__/SocietyLogo.test.tsx`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement**

`src/hooks/useSociety.ts`:

```ts
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Society } from '../types/events';
import { listedSocieties, resolveSociety } from '../utils/societies/resolveSociety';

/**
 * A society by id, re-rendering when the catalog arrives or changes. Selects
 * the catalog record (a stable reference) and resolves outside the selector:
 * resolving inside would build a new neutral object each call and loop.
 */
export function useSociety(id: string | null | undefined): Society | null {
  const catalog = useAppStore((s) => s.societies);
  return useMemo(() => (id ? resolveSociety(catalog, id) : null), [catalog, id]);
}

/** Active societies in catalog order: pickers and the subscription list. */
export function useListedSocieties(): Society[] {
  const catalog = useAppStore((s) => s.societies);
  return useMemo(() => listedSocieties(catalog), [catalog]);
}
```

`src/components/SocietyLogo.tsx`:

```tsx
import { useState } from 'react';
import type { Society } from '../types/events';
import { readableTextColor } from '../utils/readableTextColor';

interface SocietyLogoProps {
  society: Society;
  /** Size, shape and glyph text size, e.g. "h-11 w-11 rounded-full text-sm". */
  className: string;
  fit?: 'cover' | 'contain';
}

const FIT = { cover: 'object-cover', contain: 'object-contain' } as const;

/**
 * A society's logo, or its glyph on its colour when there is no logo or the
 * logo fails to load. Logos now come from Supabase Storage over the network, so
 * a failed load is ordinary; the tile keeps the slot the same size either way.
 */
export function SocietyLogo({ society, className, fit = 'cover' }: SocietyLogoProps) {
  // Keyed on the URL: a replaced logo gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(society.logo) && failedUrl !== society.logo;
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={showImage ? undefined : { backgroundColor: society.color, color: readableTextColor(society.color) }}
    >
      {showImage ? (
        <img
          src={society.logo}
          alt=""
          className={`h-full w-full ${FIT[fit]}`}
          onError={() => setFailedUrl(society.logo ?? null)}
        />
      ) : (
        <span className="font-extrabold">{society.glyph}</span>
      )}
    </span>
  );
}
```

Consumers:

- **EventDetailCard**:
  - Replace the import with `import { useSociety } from '../../hooks/useSociety';` and `import { SocietyLogo } from '../SocietyLogo';`
  - `const soc = useSociety(event.societyId)!;` (a non-empty id always resolves)
  - Replace the avatar `<span …>{soc.logo ? … : …}</span>` block (lines 84–92) with `<SocietyLogo society={soc} className="h-11 w-11 rounded-full ring-1 ring-base-300 text-sm" />`
- **EventLayer**:
  - Replace the import with `useSociety`.
  - Above `draftColor`, at component top level: `const draftSociety = useSociety(assocId);`
  - Then `const draftColor = draftSociety?.color ?? '#0046a0';`
- **AdminConsoleHeader**: import `useSociety`, and `const society = useSociety(activeId);`
- **SocietyPicker**: replace the `ALL_SOCIETIES` import with `import { useListedSocieties } from '../../hooks/useSociety';`, then `const societies = useListedSocieties();` and `societies.map(...)`.
- **SocietyChip**: body becomes

```tsx
    <span className="flex items-center gap-2">
      <SocietyLogo society={society} className="h-6 w-6 rounded-md text-[10px]" fit="contain" />
      <span className="truncate text-sm font-bold">{society.name}</span>
    </span>
```

  with `import { SocietyLogo } from '../SocietyLogo';`
- **lessonPlace**:
  - Replace `import { SOCIETIES } …` with `import type { Society } from '../types/events';`. Merge it into the existing type import if there is one.
  - Add a final parameter `societies: Record<string, Society>`.
  - Line 75 becomes `const host = societies[event.societyId]?.shortName ?? null;`
  - Each of the three callers adds `const societies = useAppStore((s) => s.societies);` beside its existing `mapEvents` selector, and passes it as the last argument.
  - `lessonPlace.test.ts` passes `BUNDLED_SOCIETIES`.

- [ ] **Step 4: Run the touched tests**

Run: `npx vitest run src/components/__tests__/SocietyLogo src/components/CampusMap src/components/AdminConsole src/utils/__tests__/lessonPlace src/components/mobile/screens/calendar src/components/__tests__/CalendarEventCard`
Expected: PASS. Where a test asserted a logo `<img>` from the old `/spolky/*.jpg` path, it now needs a catalog with a logo: set `useAppStore.setState({ societies: { ...BUNDLED_SOCIETIES, supef: { ...BUNDLED_SOCIETIES.supef!, logo: 'https://x/l.png' } } })` in that test, then assert against that URL. Do not change `SocietyLogo` to make an old assertion pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSociety.ts src/components src/utils/lessonPlace.ts src/utils/__tests__/lessonPlace.test.ts
git commit -m "feat(societies): resolve societies through the store, logos fall back to the tile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Novinky consumers; delete the old catalogs

**Files:**
- Modify: `src/components/Notifications/NotificationItem.tsx:4-5,60-69`
- Modify: `src/utils/eventAudience.ts:1,60-90`
- Modify: `src/components/CampusMap/ComposerAudienceField.tsx:24-27`
- Modify: `src/components/Sidebar/Profile/SpolkySection.tsx:3,66-80`
- Modify: `src/hooks/useSpolkySettings.ts:3,76-78`
- Modify: `src/services/spolky/config.ts` (delete `FACULTY_TO_ASSOCIATION`, `ASSOCIATION_PROFILES`; keep `API_BASE_URL`)
- Modify: `src/services/spolky/types.ts` (delete `AssociationProfile`, `FacultyId`)
- Modify: `src/services/spolky/spolkyService.ts:105-116` (delete `getUserAssociation` and its imports)
- Modify: `src/services/spolky/index.ts` (drop the deleted names)
- Modify tests: `src/utils/__tests__/eventAudience.test.ts`, `src/hooks/__tests__/useSpolkySettings.test.ts`, `src/components/NotificationFeed.test.tsx` (drop the `getUserAssociation` mock)

**Interfaces:**
- Consumes: `useListedSocieties` (Task 5), `autoFollowSocietyFor` (Task 2), `FACULTY_LABEL_TO_KEY` (existing in `src/types/events.ts`)
- Produces:
  - `audienceLabelKey(society: Society | undefined): AudienceLabel`
  - `audienceHint(society: Society | undefined): AudienceHint`

- [ ] **Step 1: Update the tests first**

In `src/utils/__tests__/eventAudience.test.ts`, change the `audienceLabelKey` / `audienceHint` cases to pass a society (`BUNDLED_SOCIETIES.x`) instead of an id, and assert:
- `audienceLabelKey(BUNDLED_SOCIETIES.esn)` → `{ key: 'admin.audience.erasmus' }`
- `audienceLabelKey(BUNDLED_SOCIETIES.supef)` → `{ key: 'admin.audience.faculty', faculty: 'PEF' }`
- `audienceLabelKey(BUNDLED_SOCIETIES.au_frrms)` → `{ key: 'admin.audience.faculty', faculty: 'FRRMS' }`
- `audienceLabelKey(BUNDLED_SOCIETIES.ey)` → `{ key: 'admin.audience.followers' }` (filed under PEF, but not its default)
- `audienceLabelKey(BUNDLED_SOCIETIES.reis)` → `{ key: 'admin.audience.followers' }`
- `audienceLabelKey(undefined)` → `{ key: 'admin.audience.followers' }`
- `audienceHint(BUNDLED_SOCIETIES.supef)` → `{ key: 'map.audienceHint', society: 'SU PEF' }`
- `audienceHint(undefined)` → `{ key: 'map.audienceHintGeneric' }`

In `src/hooks/__tests__/useSpolkySettings.test.ts`:
- Replace any mock of `spolky/config` with the real store. The default `societies` is the bundled seed.
- Keep the existing assertions: a PEF student defaults to `['supef']`, an Erasmus student to `['esn']`.
- Add one new case: with `useAppStore.setState({ societies: { ...BUNDLED_SOCIETIES, supef: { ...BUNDLED_SOCIETIES.supef!, autoFollowFaculty: false }, kino: { ...BUNDLED_SOCIETIES.supef!, id: 'kino' } } })`, a PEF student defaults to `['kino']`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/utils/__tests__/eventAudience src/hooks/__tests__/useSpolkySettings`
Expected: FAIL, because the signatures and lookup source haven't changed yet.

- [ ] **Step 3: Implement**

`src/utils/eventAudience.ts`:
- Replace `import { ASSOCIATION_PROFILES } …` with `import type { Society } from '../types/events';`
- Replace the two functions' bodies:

```ts
export function audienceLabelKey(society: Society | undefined): AudienceLabel {
  if (society?.audienceLabel === 'erasmus') return { key: 'admin.audience.erasmus' };
  // "Students of X" only for the society X's students follow BY DEFAULT: the
  // filter runs on subscriptions, and a faculty only seeds the default. EY is
  // filed under PEF but PEF students do not follow it, so it gets the generic
  // wording, as it did when it had no profile at all.
  if (society?.autoFollowFaculty && society.facultyKey !== 'mendelu') {
    return { key: 'admin.audience.faculty', faculty: society.facultyKey.toUpperCase() };
  }
  return { key: 'admin.audience.followers' };
}

export function audienceHint(society: Society | undefined): AudienceHint {
  return society
    ? { key: 'map.audienceHint', society: society.name }
    : { key: 'map.audienceHintGeneric' };
}
```

Keep and adjust the existing doc comments above them: `ASSOCIATION_PROFILES` / `facultyIds` become "the catalog" / `autoFollowFaculty`.

- **ComposerAudienceField**:

```tsx
  const society = useAppStore((s) => s.societies[societyId]);
  const audience = audienceLabelKey(society);
  const hint = audienceHint(society);
```

  Import `useAppStore` from `'../../store/useAppStore'` if it isn't imported already. `societyId` is `''` for no society, which reads `undefined`, and that is correct.
- **NotificationItem**: delete both catalog imports and add `import { useAppStore } from '../../store/useAppStore';`. Then:

```tsx
  const society = useAppStore((s) => s.societies[assocId]);
  const source = society?.name ?? t('notifications.fromReis');
  // The catalog, never resolveSociety: an id that is not a society (reIS
  // announcements, academic rows) keeps the tinted bell, not a neutral tile.
  const logo = society?.logo ?? null;
```

  Its existing `onError` stays. Reword its comment: logos now come from Supabase Storage.
- **SpolkySection**: replace the config import with `import { useListedSocieties } from '../../../hooks/useSociety';`. In the body, `const societies = useListedSocieties();`, and map `societies` (`p.id`, `p.name`) where it mapped `Object.values(ASSOCIATION_PROFILES)`. Update the `expandFully` doc comment: "seven societies" becomes "every society in the catalog".
- **useSpolkySettings**:
  - Replace the config import with:
    - `import { useAppStore } from '../store/useAppStore';`
    - `import { autoFollowSocietyFor } from '../utils/societies/resolveSociety';`
    - `import { FACULTY_LABEL_TO_KEY } from '../types/events';`
  - Replace lines 76–78 with:

```ts
          // The faculty's default society comes from the catalog, which is
          // never empty (bundled seed), so this cannot run "before" it.
          const facultyKey = facultyLabel ? FACULTY_LABEL_TO_KEY[facultyLabel] : undefined;
          const facultyDefault = facultyKey
            ? autoFollowSocietyFor(useAppStore.getState().societies, facultyKey)
            : null;
          if (facultyDefault && !erasmus) defaults.push(facultyDefault);
```

- Delete `FACULTY_TO_ASSOCIATION` and `ASSOCIATION_PROFILES` from `config.ts` and their import in `config.ts`.
- Delete `AssociationProfile` and `FacultyId` from `types.ts`.
- Delete `getUserAssociation` from `spolkyService.ts`.
- Delete the matching names from `index.ts`, and the `getUserAssociation` mock in `NotificationFeed.test.tsx`.

- [ ] **Step 4: Confirm nothing references the old names**

Run: `grep -rn "ASSOCIATION_PROFILES\|FACULTY_TO_ASSOCIATION\|AssociationProfile\|societyById\|ALL_SOCIETIES\|\bSOCIETIES\b\|getUserAssociation\|/spolky/" src capacitor dev`
Expected: no output. Read the full output; never pipe it through `head`.

- [ ] **Step 5: Typecheck and run the touched tests**

Run: `npm run typecheck`
Expected: exit 0. This is the first point since Task 2 where it must be green.

Run: `npx vitest run src/utils/__tests__/eventAudience src/hooks/__tests__/useSpolkySettings src/components/Notifications src/components/NotificationFeed src/components/Sidebar src/components/mobile/screens/__tests__/ProfileScreen src/components/CampusMap/__tests__/EventComposer src/services/spolky`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(societies): Novinky reads the catalog; delete the hardcoded society lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Admin write API and the logo encoder

**Files:**
- Create: `src/api/societiesAdmin.ts`
- Create: `src/utils/societies/encodeSocietyLogo.ts`
- Create test: `src/api/__tests__/societiesAdmin.test.ts`
- Create test: `src/utils/societies/__tests__/encodeSocietyLogo.test.ts`
- Modify: `src/store/slices/createSocietiesSlice.ts` (add `saveSociety`, `setSocietyActive`)
- Modify test: `src/store/slices/__tests__/createSocietiesSlice.test.ts`
- Modify: `privacy/disclosures.ts`, only if Task 3 deferred `src/api/societiesAdmin.ts`

**Interfaces:**
- Consumes: `SOCIETY_LOGO_BUCKET`, `SOCIETY_COLUMNS`, `rowToSociety`, `SocietyRow` (Task 3), `putSociety` (Task 4), `hashBytes` (`src/services/notes/imageNormalize.ts`), `DEV_SOCIETY` (`src/utils/mock/devSociety.ts`)
- Produces:
  - `interface SocietyInput { id: string; name: string; shortName: string; color: string; facultyKey: FacultyKey; autoFollowFaculty: boolean }`
  - `logoObjectPath(id: string, png: Blob): Promise<string>`
  - `uploadSocietyLogo(id: string, png: Blob): Promise<string | null>`
  - `removeSocietyLogo(path: string): Promise<void>`
  - `insertSociety(input: SocietyInput, logoPath: string, sortOrder: number): Promise<Society | null>`
  - `updateSociety(id: string, patch: Partial<SocietyRow>): Promise<Society | null>`
  - `LOGO_SIDE = 256`
  - `squareCrop(w: number, h: number): { sx: number; sy: number; side: number }`
  - `encodeSocietyLogo(file: Blob): Promise<Blob>`
  - slice `saveSociety(input: SocietyInput, logo: Blob | null, isNew: boolean): Promise<{ error?: 'logo_required' | 'upload_failed' | 'save_failed' }>`
  - slice `setSocietyActive(id: string, active: boolean): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

`src/utils/societies/__tests__/encodeSocietyLogo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { squareCrop, LOGO_SIDE } from '../encodeSocietyLogo';

describe('squareCrop', () => {
  it('centres a square on a wide image', () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
  });
  it('centres a square on a tall image', () => {
    expect(squareCrop(200, 500)).toEqual({ sx: 0, sy: 150, side: 200 });
  });
  it('leaves a square alone', () => {
    expect(squareCrop(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
  it('targets 256px', () => {
    expect(LOGO_SIDE).toBe(256);
  });
});
```

`src/api/__tests__/societiesAdmin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upload = vi.fn();
const remove = vi.fn();
const single = vi.fn();
vi.mock('../../services/admin/authClient', () => ({
  adminAuthClient: {
    storage: { from: () => ({ upload, remove }) },
    from: () => ({
      insert: () => ({ select: () => ({ single }) }),
      update: () => ({ eq: () => ({ select: () => ({ single }) }) }),
    }),
  },
}));
vi.mock('../../utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { logoObjectPath, uploadSocietyLogo, insertSociety } from '../societiesAdmin';

const png = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

beforeEach(() => {
  upload.mockReset();
  single.mockReset();
});

describe('logoObjectPath', () => {
  it('is <id>/<32 hex>.png, the shape the database check accepts', async () => {
    expect(await logoObjectPath('kino', png)).toMatch(/^kino\/[0-9a-f]{32}\.png$/);
  });
  it('is stable for the same bytes and different for different bytes', async () => {
    const other = new Blob([new Uint8Array([9])], { type: 'image/png' });
    expect(await logoObjectPath('kino', png)).toBe(await logoObjectPath('kino', png));
    expect(await logoObjectPath('kino', png)).not.toBe(await logoObjectPath('kino', other));
  });
});

describe('uploadSocietyLogo', () => {
  it('returns the path on success', async () => {
    upload.mockResolvedValue({ error: null });
    expect(await uploadSocietyLogo('kino', png)).toMatch(/^kino\//);
    expect(upload.mock.calls[0]![2]).toMatchObject({ contentType: 'image/png', upsert: false });
  });
  it('treats "already exists" as success: same bytes, same path', async () => {
    upload.mockResolvedValue({ error: { message: 'The resource already exists' } });
    expect(await uploadSocietyLogo('kino', png)).toMatch(/^kino\//);
  });
  it('returns null on any other error', async () => {
    upload.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } });
    expect(await uploadSocietyLogo('kino', png)).toBeNull();
  });
});

describe('insertSociety', () => {
  it('maps the saved row back to a Society', async () => {
    single.mockResolvedValue({
      data: { id: 'kino', name: 'Kino', short_name: 'KINO', color: '#123456', faculty_key: 'zf',
        auto_follow_faculty: false, audience_label: null, logo_path: 'kino/aa.png', sort_order: 90, is_active: true },
      error: null,
    });
    const s = await insertSociety(
      { id: 'kino', name: 'Kino', shortName: 'KINO', color: '#123456', facultyKey: 'zf', autoFollowFaculty: false },
      'kino/aa.png', 90
    );
    expect(s?.shortName).toBe('KINO');
  });
  it('returns null on error', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'duplicate key' } });
    expect(await insertSociety(
      { id: 'esn', name: 'x', shortName: 'x', color: '#123456', facultyKey: 'zf', autoFollowFaculty: false },
      'esn/aa.png', 1
    )).toBeNull();
  });
});
```

Add to `src/store/slices/__tests__/createSocietiesSlice.test.ts`: mock `../../../api/societiesAdmin` and `../../../utils/societies/encodeSocietyLogo` (identity), then assert:
- a new society with `logo: null` returns `{ error: 'logo_required' }` and calls no API
- a failed upload returns `{ error: 'upload_failed' }` and inserts nothing
- a successful new save calls `uploadSocietyLogo`, then `insertSociety`, then shows the result in `societies`
- an edit that replaces the logo calls `removeSocietyLogo(oldPath)` only after `updateSociety` succeeds. To get the old path, give the society a `logo` URL built with `logoPublicUrl('supef/<32 hex>.png')`.
- `setSocietyActive('zf', false)` calls `updateSociety('zf', { is_active: false })` and marks it hidden.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/utils/societies/__tests__/encodeSocietyLogo src/api/__tests__/societiesAdmin src/store/slices/__tests__/createSocietiesSlice`
Expected: FAIL, because the modules and actions don't exist.

- [ ] **Step 3: Implement**

`src/utils/societies/encodeSocietyLogo.ts`:

```ts
export const LOGO_SIDE = 256;

/** The largest centred square: a logo is shown in round and square slots. */
export function squareCrop(w: number, h: number): { sx: number; sy: number; side: number } {
  const side = Math.min(w, h);
  return { sx: (w - side) / 2, sy: (h - side) / 2, side };
}

/**
 * Re-encodes an uploaded logo on the device: centre-cropped square, 256×256,
 * PNG (keeps transparency). Drawing through a canvas also drops the original's
 * metadata. Accepts what createImageBitmap reads everywhere (PNG, JPEG, WebP);
 * the form's file input limits the picker to those, so SVG never arrives here.
 */
export async function encodeSocietyLogo(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = LOGO_SIDE;
    canvas.height = LOGO_SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, LOGO_SIDE, LOGO_SIDE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    return blob;
  } finally {
    bitmap.close();
  }
}
```

`src/api/societiesAdmin.ts`:

```ts
import { adminAuthClient } from '../services/admin/authClient';
import { hashBytes } from '../services/notes/imageNormalize';
import { DEV_SOCIETY } from '../utils/mock/devSociety';
import { logError } from '../utils/reportError';
import type { FacultyKey, Society } from '../types/events';
import { SOCIETY_COLUMNS, SOCIETY_LOGO_BUCKET, rowToSociety, type SocietyRow } from './societies';

// Admin writes to the societies catalog. RLS lets only reis_admin through; the
// console gating on the role is a convenience, never the authorization.
// Under VITE_DEV_SOCIETY (npm run dev:web) the session is fake and cannot pass
// RLS, so writes succeed locally and never reach Supabase. Never cite them as
// evidence the write path works.

export interface SocietyInput {
  id: string;
  name: string;
  shortName: string;
  color: string;
  facultyKey: FacultyKey;
  autoFollowFaculty: boolean;
}

/** Content-addressed, so a replaced logo is a new URL no CDN has cached. */
export async function logoObjectPath(id: string, png: Blob): Promise<string> {
  const hex = await hashBytes(await png.arrayBuffer());
  return `${id}/${hex.slice(0, 32)}.png`;
}

export async function uploadSocietyLogo(id: string, png: Blob): Promise<string | null> {
  const path = await logoObjectPath(id, png);
  if (DEV_SOCIETY) return path;
  const { error } = await adminAuthClient.storage
    .from(SOCIETY_LOGO_BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: false, cacheControl: '31536000' });
  // Same bytes, same path: a retry after a failed row save lands here.
  if (error && !/already exists/i.test(error.message)) {
    logError('Api.uploadSocietyLogo', error);
    return null;
  }
  return path;
}

export async function removeSocietyLogo(path: string): Promise<void> {
  if (DEV_SOCIETY) return;
  const { error } = await adminAuthClient.storage.from(SOCIETY_LOGO_BUCKET).remove([path]);
  // An orphaned file costs a few KB; it must never fail the save it follows.
  if (error) logError('Api.removeSocietyLogo', error);
}

function devRow(row: Partial<SocietyRow> & { id: string }): Society | null {
  return rowToSociety({
    name: row.id, short_name: row.id, color: '#6b7280', faculty_key: 'mendelu',
    auto_follow_faculty: false, audience_label: null, logo_path: null, sort_order: 0,
    is_active: true, ...row,
  });
}

export async function insertSociety(
  input: SocietyInput,
  logoPath: string,
  sortOrder: number
): Promise<Society | null> {
  const row = {
    id: input.id, name: input.name.trim(), short_name: input.shortName.trim(),
    color: input.color, faculty_key: input.facultyKey,
    auto_follow_faculty: input.autoFollowFaculty, logo_path: logoPath, sort_order: sortOrder,
  };
  if (DEV_SOCIETY) return devRow(row);
  const { data, error } = await adminAuthClient.from('societies').insert(row).select(SOCIETY_COLUMNS).single();
  if (error || !data) {
    logError('Api.insertSociety', error);
    return null;
  }
  return rowToSociety(data as SocietyRow);
}

export async function updateSociety(id: string, patch: Partial<SocietyRow>): Promise<Society | null> {
  if (DEV_SOCIETY) return devRow({ id, ...patch });
  const { data, error } = await adminAuthClient
    .from('societies').update(patch).eq('id', id).select(SOCIETY_COLUMNS).single();
  if (error || !data) {
    logError('Api.updateSociety', error);
    return null;
  }
  return rowToSociety(data as SocietyRow);
}
```

In dev mode `devRow` returns a minimal row. The slice merges it over the existing society (next block), so dev-mode edits display correctly.

Slice additions in `createSocietiesSlice.ts`: extend the interface with the two actions, then implement them:

```ts
  saveSociety: async (input, logo, isNew) => {
    if (isNew && !logo) return { error: 'logo_required' };
    const previous = get().societies[input.id];
    let logoPath: string | undefined;
    if (logo) {
      const png = await encodeSocietyLogo(logo);
      const uploaded = await uploadSocietyLogo(input.id, png);
      if (!uploaded) return { error: 'upload_failed' };
      logoPath = uploaded;
    }
    const nextSort = Math.max(0, ...Object.values(get().societies).map((s) => s.sortOrder)) + 10;
    const saved = isNew
      ? await insertSociety(input, logoPath!, nextSort)
      : await updateSociety(input.id, {
          name: input.name.trim(), short_name: input.shortName.trim(), color: input.color,
          faculty_key: input.facultyKey, auto_follow_faculty: input.autoFollowFaculty,
          ...(logoPath ? { logo_path: logoPath } : {}),
        });
    if (!saved) return { error: 'save_failed' };
    await get().putSociety({ ...previous, ...saved });
    const oldPath = previous?.logo ? logoPathFromUrl(previous.logo) : null;
    if (logoPath && oldPath && oldPath !== logoPath) await removeSocietyLogo(oldPath);
    return {};
  },

  setSocietyActive: async (id, active) => {
    const saved = await updateSociety(id, { is_active: active });
    if (!saved) return false;
    await get().putSociety({ ...get().societies[id]!, ...saved, isActive: active });
    return true;
  },
```

Add a module helper in the slice file:

```ts
const LOGO_MARKER = `/object/public/${SOCIETY_LOGO_BUCKET}/`;
/** The storage path back out of a public URL, for deleting a replaced logo. */
function logoPathFromUrl(url: string): string | null {
  const at = url.indexOf(LOGO_MARKER);
  return at === -1 ? null : url.slice(at + LOGO_MARKER.length);
}
```

Import `encodeSocietyLogo`, `uploadSocietyLogo`, `insertSociety`, `updateSociety`, `removeSocietyLogo`, `SocietyInput` and `SOCIETY_LOGO_BUCKET`. If the slice file grows past ~200 lines, move `saveSociety` and `setSocietyActive` into `src/store/slices/societies/saveSociety.ts` as functions taking `(get, ...)`, and call them from the slice.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/utils/societies src/api/__tests__/societiesAdmin src/store/slices/__tests__/createSocietiesSlice src/test/guards scripts/lib/__tests__/privacyDisclosures`
Expected: PASS. The guard regex is `supabase.(rpc|from)(`, and `adminAuthClient.from(` does not match it, which is correct: admin clients are covered by the disclosures `EXEMPT` entry.

- [ ] **Step 5: Commit**

```bash
git add src/api/societiesAdmin.ts src/api/__tests__/societiesAdmin.test.ts src/utils/societies src/store/slices privacy
git commit -m "feat(societies): admin writes and on-device logo encoding

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Admin console: Societies panel and form

**Files:**
- Create: `src/components/AdminConsole/SocietiesPanel.tsx`
- Create: `src/components/AdminConsole/SocietyForm.tsx`
- Create test: `src/components/AdminConsole/__tests__/SocietyForm.test.tsx`
- Create test: `src/components/AdminConsole/__tests__/SocietiesPanel.test.tsx`
- Modify: `src/components/AdminConsole/SocietyAccountsPanel.tsx:6,55-61` (the catalog comes from the store)
- Modify: `src/components/AdminConsole/AdminConsole.tsx:131`, `MobileAdminConsole.tsx:115`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (inside `"admin"`)

**Interfaces:**
- Consumes: `saveSociety`, `setSocietyActive`, `societies` (Tasks 4 and 7), `useListedSocieties` (Task 5), `SocietyLogo` (Task 5), `isUsablePinColor` (Task 2), `createSocietyAccount` (`src/api/societyAccounts.ts`), `GeneratedPasswordDialog` (existing), `ORGANIZERS` (`src/types/events.ts`)
- Produces: `<SocietiesPanel />` (reis_admin only, mounted where `SocietyAccountsPanel` is); `<SocietyForm society?: Society onDone: () => void />`

- [ ] **Step 1: Add the i18n keys**

Add under `"admin"` in `cs.json`:

```json
    "societies": {
      "title": "Spolky",
      "add": "Přidat spolek",
      "edit": "Upravit",
      "hide": "Skrýt",
      "show": "Zobrazit",
      "hidden": "Skrytý",
      "id": "Přihlašovací jméno",
      "idHint": "Malá písmena, číslice, _ nebo -. Později nejde změnit.",
      "name": "Název",
      "shortName": "Zkratka",
      "color": "Barva špendlíku",
      "faculty": "Fakulta",
      "wholeMendelu": "Celá MENDELU",
      "autoFollow": "Noví studenti této fakulty ho automaticky odebírají",
      "autoFollowMoves": "Automatické odebírání se přesune ze spolku {from}.",
      "logo": "Logo",
      "save": "Uložit",
      "cancel": "Zrušit",
      "errors": {
        "id": "Přihlašovací jméno smí obsahovat jen malá písmena, číslice, _ a -.",
        "idTaken": "Spolek s tímto jménem už existuje.",
        "required": "Vyplňte název i zkratku.",
        "color": "Tahle barva na světlé mapě zanikne. Zvolte tmavší.",
        "logo_required": "Nahrajte logo.",
        "upload_failed": "Logo se nepodařilo nahrát.",
        "save_failed": "Spolek se nepodařilo uložit.",
        "account_failed": "Spolek je uložený, ale účet se nepodařilo vytvořit. Vytvořte ho níže."
      }
    },
```

`en.json`, same keys:

```json
    "societies": {
      "title": "Societies",
      "add": "Add society",
      "edit": "Edit",
      "hide": "Hide",
      "show": "Show",
      "hidden": "Hidden",
      "id": "Login name",
      "idHint": "Lowercase letters, digits, _ or -. Cannot be changed later.",
      "name": "Name",
      "shortName": "Short name",
      "color": "Pin colour",
      "faculty": "Faculty",
      "wholeMendelu": "All of MENDELU",
      "autoFollow": "New students of this faculty follow it automatically",
      "autoFollowMoves": "Automatic following moves from {from}.",
      "logo": "Logo",
      "save": "Save",
      "cancel": "Cancel",
      "errors": {
        "id": "The login name may contain only lowercase letters, digits, _ and -.",
        "idTaken": "A society with this name already exists.",
        "required": "Fill in the name and the short name.",
        "color": "This colour disappears on the light map. Pick a darker one.",
        "logo_required": "Upload a logo.",
        "upload_failed": "The logo could not be uploaded.",
        "save_failed": "The society could not be saved.",
        "account_failed": "The society is saved, but its account could not be created. Create it below."
      }
    },
```

Interpolation is single-brace (`{from}`), per `src/i18n/translate.ts:43`.

- [ ] **Step 2: Write the failing form test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

vi.mock('../../../api/societyAccounts', () => ({
  createSocietyAccount: vi.fn(async () => ({ password: 'generated-pw-123' })),
}));
import { createSocietyAccount } from '../../../api/societyAccounts';
import { SocietyForm } from '../SocietyForm';

const saveSociety = vi.fn(async () => ({}));

beforeEach(() => {
  saveSociety.mockClear();
  vi.mocked(createSocietyAccount).mockClear();
  useAppStore.setState({ societies: BUNDLED_SOCIETIES, saveSociety } as never);
});

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const logoFile = new File([new Uint8Array([1])], 'logo.png', { type: 'image/png' });

describe('SocietyForm (new)', () => {
  it('rejects an id that is not a valid login', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'Kino Klub');
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(saveSociety).not.toHaveBeenCalled();
  });

  it('rejects a taken id', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'esn');
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('rejects a colour that disappears on the light map', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'kino');
    fill(/^name$|^název$/i, 'Kino');
    fill(/short name|zkratka/i, 'KINO');
    fill(/pin colou?r|barva/i, '#ffe600');
    fireEvent.change(screen.getByLabelText(/^logo$/i), { target: { files: [logoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(saveSociety).not.toHaveBeenCalled();
  });

  it('saves the society, then creates its account and shows the password once', async () => {
    render(<SocietyForm onDone={() => {}} />);
    fill(/login name|přihlašovací jméno/i, 'kino');
    fill(/^name$|^název$/i, 'Kino');
    fill(/short name|zkratka/i, 'KINO');
    fill(/pin colou?r|barva/i, '#123456');
    fireEvent.change(screen.getByLabelText(/^logo$/i), { target: { files: [logoFile] } });
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() => expect(saveSociety).toHaveBeenCalledTimes(1));
    expect(saveSociety).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kino', name: 'Kino', shortName: 'KINO', color: '#123456' }),
      logoFile,
      true
    );
    await waitFor(() => expect(createSocietyAccount).toHaveBeenCalledWith('kino', 'Kino'));
    expect(await screen.findByText('generated-pw-123')).toBeInTheDocument();
  });
});

describe('SocietyForm (edit)', () => {
  it('locks the id and saves without requiring a new logo', async () => {
    render(<SocietyForm society={BUNDLED_SOCIETIES.zf} onDone={() => {}} />);
    expect(screen.getByLabelText(/login name|přihlašovací jméno/i)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /save|uložit/i }));
    await waitFor(() =>
      expect(saveSociety).toHaveBeenCalledWith(expect.objectContaining({ id: 'zf' }), null, false)
    );
    expect(createSocietyAccount).not.toHaveBeenCalled();
  });
});
```

Check `GeneratedPasswordDialog` for how it renders the password. If it isn't plain text, assert on whatever it does render (its own test in `__tests__/SocietyAccountsPanel.credentials.test.tsx` shows how).

- [ ] **Step 3: Run it and see it fail**

Run: `npx vitest run src/components/AdminConsole/__tests__/SocietyForm.test.tsx`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 4: Implement `SocietyForm.tsx`**

```tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createSocietyAccount } from '../../api/societyAccounts';
import { ORGANIZERS, type FacultyKey, type Society } from '../../types/events';
import { isUsablePinColor } from '../../utils/societies/pinColor';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

/** Add (no `society`) or edit one society. reis_admin only; RLS is the real gate. */
export function SocietyForm({ society, onDone }: { society?: Society; onDone: () => void }) {
  const { t } = useTranslation();
  const catalog = useAppStore((s) => s.societies);
  const saveSociety = useAppStore((s) => s.saveSociety);
  const isNew = !society;
  const [id, setId] = useState(society?.id ?? '');
  const [name, setName] = useState(society?.name ?? '');
  const [shortName, setShortName] = useState(society?.shortName ?? '');
  const [color, setColor] = useState(society?.color ?? '#0046a0');
  const [facultyKey, setFacultyKey] = useState<FacultyKey>(society?.facultyKey ?? 'mendelu');
  const [autoFollow, setAutoFollow] = useState(society?.autoFollowFaculty ?? false);
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  const holder = Object.values(catalog).find(
    (s) => s.autoFollowFaculty && s.facultyKey === facultyKey && s.id !== id && s.isActive
  );

  const validate = (): string | null => {
    if (isNew && !ID_RE.test(id)) return 'errors.id';
    if (isNew && catalog[id]) return 'errors.idTaken';
    if (!name.trim() || !shortName.trim()) return 'errors.required';
    if (!isUsablePinColor(color)) return 'errors.color';
    if (isNew && !logo) return 'errors.logo_required';
    return null;
  };

  const submit = async () => {
    if (busy) return;
    const invalid = validate();
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const autoFollowFaculty = autoFollow && facultyKey !== 'mendelu';
    // The database allows one default per faculty: release it from the holder first.
    if (autoFollowFaculty && holder) {
      const moved = await saveSociety({ ...holder, autoFollowFaculty: false }, null, false);
      if (moved.error) {
        setBusy(false);
        return setError(`errors.${moved.error}`);
      }
    }
    const res = await saveSociety(
      { id, name, shortName, color, facultyKey, autoFollowFaculty },
      logo,
      isNew
    );
    if (res.error) {
      setBusy(false);
      return setError(`errors.${res.error}`);
    }
    if (isNew) {
      const account = await createSocietyAccount(id, name.trim());
      if (account.password) setPassword(account.password);
      else setError('errors.account_failed');
    }
    setBusy(false);
    if (!isNew) onDone();
  };

  const field = 'flex flex-col gap-1 text-sm';
  const facultyName = (k: FacultyKey) =>
    k === 'mendelu' ? t('admin.societies.wholeMendelu') : ORGANIZERS[k][language === 'en' ? 'en' : 'cz'];

  return (
    <div className="flex flex-col gap-3">
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.id')}</span>
        <input className="input input-bordered" value={id} disabled={!isNew}
          onChange={(e) => setId(e.target.value.trim())} />
        <span className="text-xs text-base-content/70">{t('admin.societies.idHint')}</span>
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.name')}</span>
        <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.shortName')}</span>
        <input className="input input-bordered" value={shortName} maxLength={24}
          onChange={(e) => setShortName(e.target.value)} />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.color')}</span>
        <input type="color" className="input input-bordered h-10 w-20 p-1" value={color}
          onChange={(e) => setColor(e.target.value)} />
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.faculty')}</span>
        <select className="select select-bordered" value={facultyKey}
          onChange={(e) => setFacultyKey(e.target.value as FacultyKey)}>
          {FACULTIES.map((k) => <option key={k} value={k}>{facultyName(k)}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
          checked={autoFollow && facultyKey !== 'mendelu'} disabled={facultyKey === 'mendelu'}
          onChange={(e) => setAutoFollow(e.target.checked)} />
        <span>
          {t('admin.societies.autoFollow')}
          {autoFollow && holder && (
            <span className="block text-xs text-base-content/70">
              {t('admin.societies.autoFollowMoves', { from: holder.name })}
            </span>
          )}
        </span>
      </label>
      <label className={field}>
        <span className="opacity-70">{t('admin.societies.logo')}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp"
          className="file-input file-input-bordered file-input-sm"
          onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      </label>
      {logo && <LogoPreview file={logo} />}
      {error && <p role="alert" className="text-error text-sm">{t(`admin.societies.${error}`)}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
          {t('admin.societies.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('admin.societies.cancel')}
        </button>
      </div>
      {password && (
        <GeneratedPasswordDialog password={password} login={id}
          onClose={() => { setPassword(null); onDone(); }} />
      )}
    </div>
  );
}

/** Square preview of the picked file; the object URL is revoked when it changes. */
function LogoPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-base-300" />;
}
```

Change the component's first import line to `import { useEffect, useMemo, useState } from 'react';`, and read `language` from the translation hook: `const { t, language } = useTranslation();`. The `useEffect` in `LogoPreview` only releases an object URL; it fetches nothing, so the no-`useEffect`-fetching rule is not touched. jsdom has no `URL.createObjectURL`. If the form test throws on it, stub it in that test: `URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();`.

Prettier will reflow the JSX. If the file runs over ~200 lines, move `validate` and the `holder` lookup into `src/components/AdminConsole/societyFormRules.ts` as pure functions, and `LogoPreview` into its own file.

Check `useTranslation`'s `t` signature for interpolation (a second-argument object). If it differs, adapt the `autoFollowMoves` call to match how existing callers interpolate.

- [ ] **Step 5: Implement `SocietiesPanel.tsx`**

```tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { ORGANIZERS, type Society } from '../../types/events';
import { SocietyLogo } from '../SocietyLogo';
import { SocietyForm } from './SocietyForm';

/** reIS-admin-only list of every society, hidden ones included. */
export function SocietiesPanel() {
  const { t, language } = useTranslation();
  const catalog = useAppStore((s) => s.societies);
  const setSocietyActive = useAppStore((s) => s.setSocietyActive);
  const [editing, setEditing] = useState<Society | 'new' | null>(null);
  const all = Object.values(catalog).sort((a, b) => a.sortOrder - b.sortOrder);

  if (editing) {
    return (
      <SocietyForm society={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t('admin.societies.title')}</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          {t('admin.societies.add')}
        </button>
      </div>
      {all.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-lg border border-base-300 p-2">
          <SocietyLogo society={s} className="h-8 w-8 rounded-md text-xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{s.name}</div>
            <div className="truncate text-xs text-base-content/70">
              {s.facultyKey === 'mendelu'
                ? t('admin.societies.wholeMendelu')
                : ORGANIZERS[s.facultyKey][language === 'en' ? 'en' : 'cz']}
              {!s.isActive && ` · ${t('admin.societies.hidden')}`}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>
            {t('admin.societies.edit')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void setSocietyActive(s.id, !s.isActive)}
          >
            {s.isActive ? t('admin.societies.hide') : t('admin.societies.show')}
          </button>
        </div>
      ))}
    </div>
  );
}
```

`SocietiesPanel.test.tsx`: render with `useAppStore.setState({ societies: BUNDLED_SOCIETIES, setSocietyActive: vi.fn(async () => true) })`, then assert:
- all 8 names render
- clicking "Hide" on ZF calls `setSocietyActive('zf', false)`
- clicking "Add society" renders the form (its Save button)
- a hidden society shows the hidden label and a "Show" button

`SocietyAccountsPanel.tsx`:
- Replace `import { ALL_SOCIETIES } …` with `import { useListedSocieties } from '../../hooks/useSociety';`
- In the body: `const societies = useListedSocieties();`
- Replace both `ALL_SOCIETIES` uses with `societies`.
- Rewrite the comment above `available`: "Only ids in the catalog may be created: the spolky_accounts foreign key rejects any other. A society saved from the form whose account step failed shows up here."

Mount: in `AdminConsole.tsx:131` and `MobileAdminConsole.tsx:115`, change `{isReisAdmin && <SocietyAccountsPanel />}` to:

```tsx
                {isReisAdmin && <SocietiesPanel />}
                {isReisAdmin && <SocietyAccountsPanel />}
```

and add `import { SocietiesPanel } from './SocietiesPanel';`. Change the `admin.accountsTab` label to `"Spolky a účty"` / `"Societies & accounts"`.

- [ ] **Step 6: Run the admin tests**

Run: `npx vitest run src/components/AdminConsole`
Expected: PASS, including the existing `SocietyAccountsPanel*` and `AdminConsole` / `MobileAdminConsole` tests. If a test finds the tab by the old "Účty" / "Accounts" label, update the label it queries.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminConsole src/i18n/locales
git commit -m "feat(admin): add, edit and hide societies from the console

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Logo seed script and the prod rollout runbook

**Files:**
- Move: `public/spolky/*` → `scripts/society-logos/` (`git mv`)
- Create: `scripts/seed-society-logos.ts`
- Create: `docs/runbooks/societies-catalog-rollout.md`

**Interfaces:**
- Consumes: the migration (Task 1), the path rule `<id>/<32 hex>.png` (Task 7's `logoObjectPath`, which hashes the uploaded PNG bytes with SHA-256)

- [ ] **Step 1: Move the source logos out of the shipped bundle**

```bash
git mv public/spolky scripts/society-logos
```

Then check nothing still points at the old path. Read the whole output:

```bash
grep -rn "spolky/" src public wxt.config.ts capacitor dev scripts/check-app.ts
```

Expected: no reference to `/spolky/<file>` assets.

- [ ] **Step 2: Write the seed script**

`scripts/seed-society-logos.ts`, run with `npx tsx scripts/seed-society-logos.ts`:

```ts
/**
 * One-off: rasterize the eight existing society logos to 256×256 PNG, upload
 * them to the society-logos bucket, and print the SQL that points each
 * societies row at its file. Run ONCE, after the migration, by hand. See
 * docs/runbooks/societies-catalog-rollout.md.
 *
 * Uploads through `npx supabase storage cp --linked`, which uses the linked
 * project's service credentials, so no admin password is needed. It prints SQL
 * rather than running it, so a human reads it before prod changes.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCES: Record<string, string> = {
  esn: 'scripts/society-logos/esn.jpg',
  supef: 'scripts/society-logos/supef.jpg',
  au_frrms: 'scripts/society-logos/au_frrms.jpg',
  usaf: 'scripts/society-logos/usaf.jpg',
  ldf: 'scripts/society-logos/ldf.jpg',
  zf: 'scripts/society-logos/zf.jpg',
  ey: 'scripts/society-logos/ey.svg',
  reis: 'public/reIS_logo.svg',
};

const MIME: Record<string, string> = { jpg: 'image/jpeg', svg: 'image/svg+xml' };
const SIDE = 256;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const out = mkdtempSync(join(tmpdir(), 'society-logos-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIDE, height: SIDE } });
  const sql: string[] = [];

  for (const [id, file] of Object.entries(SOURCES)) {
    const ext = file.split('.').pop()!;
    const dataUrl = `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`;
    // Centre-crop to a square, the same framing encodeSocietyLogo gives an upload.
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
         <img src="${dataUrl}" style="width:${SIDE}px;height:${SIDE}px;object-fit:cover;display:block">
       </body></html>`
    );
    await page.waitForFunction(() => document.images[0]?.complete);
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    const hash = createHash('sha256').update(png).digest('hex').slice(0, 32);
    const objectPath = `${id}/${hash}.png`;
    const local = join(out, `${id}.png`);
    writeFileSync(local, png);
    if (!dryRun) {
      execFileSync(
        'npx',
        ['supabase', 'storage', 'cp', '--linked', '--experimental',
         '--content-type', 'image/png', '--cache-control', 'max-age=31536000',
         local, `ss:///society-logos/${objectPath}`],
        { stdio: 'inherit' }
      );
    }
    sql.push(`update public.societies set logo_path = '${objectPath}' where id = '${id}';`);
  }

  await browser.close();
  console.log(`\nPNGs in ${out}. Review them, then apply:\n\nbegin;\n${sql.join('\n')}\ncommit;\n`);
}

void main();
```

Check whether `supabase storage cp` needs `--experimental` on the installed CLI version: run `npx supabase storage --help` and drop the flag if it isn't listed.

- [ ] **Step 3: Dry-run it locally, touching nothing remote**

Run: `npx tsx scripts/seed-society-logos.ts --dry-run`
Expected: eight PNGs in a temp dir and eight `update` lines printed. Open each PNG with the Read tool and check it is the right logo, square, and not blank. EY and reIS must render from SVG.

- [ ] **Step 4: Write the runbook**

`docs/runbooks/societies-catalog-rollout.md`, with these steps in order:

1. Merge the PR into `test`. Nothing is applied by the merge.
2. Dry-run the migration against prod with the self-unwinding `DO` block pattern from memory `migrations-do-not-self-apply`. Wrap the body and end with `raise exception 'DRY RUN OK >> societies=% fk=%', (select count(*) from public.societies), (select count(*) from pg_constraint where conname = 'spolky_accounts_association_id_fkey');`. The body has no early `return`, so the raise is always reached. The `create policy` statements on `storage.objects` also unwind.
3. Apply: `npx supabase db query --linked -f supabase/migrations/20260926120000_societies_catalog.sql`.
4. Verify through the public API with the shipped publishable key, not as the superuser the CLI connects as:
   - `curl -s "$SUPABASE_URL/rest/v1/societies?select=id" -H "apikey: $KEY"` returns 8 ids
   - a `POST` with the same key is rejected (401/403)
5. `npx tsx scripts/seed-society-logos.ts`, then read the printed SQL and apply it with `npx supabase db query --linked "<the begin…commit block>"`.
6. Open one logo URL in a browser: `<SUPABASE_URL>/storage/v1/object/public/society-logos/<path>`.
7. Release to all stores (`/release`). Tell Dominik not to add the first new society until most installs run this release. Installed older versions show a database-only society as ESN, and iOS updates slowest.

Steps 2–5 change production. They are **Dominik's call at merge time**, not the implementer's.

- [ ] **Step 5: Commit**

```bash
git add scripts/society-logos scripts/seed-society-logos.ts docs/runbooks/societies-catalog-rollout.md public
git commit -m "chore(societies): logo seed script and prod rollout runbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end verification and the PR

**Files:** none new, apart from screenshots in the scratchpad.

- [ ] **Step 1: Local gates**

Run: `npm run typecheck`, then
`npx vitest run src/utils/societies src/data src/api/__tests__/societies src/api/__tests__/societiesAdmin src/api/__tests__/mapEvents src/store/slices/__tests__/createSocietiesSlice src/store/slices/__tests__/createMapSlice src/components/AdminConsole src/components/CampusMap src/components/Notifications src/components/Sidebar src/hooks src/utils/__tests__ src/test/guards scripts/lib/__tests__/privacyDisclosures`
Expected: exit 0 for both. Paste the summary lines into the PR.

- [ ] **Step 2: Tree parity check**

- Desktop: the extension renders `AdminConsole`, the sidebar `SpolkySection`, `EventDetailCard` and `NotificationItem`.
- Phone: the app renders `MobileAdminConsole`, `ProfileScreen` → `SpolkySection`, the map sheet → `EventDetailCard`, and `NotificationsSheet` → `NotificationItem`.
- Tablet: same as phone.

Both trees get every change through shared components. If the `tree-parity` Stop hook asks, answer with that list.

- [ ] **Step 3: UI verification (`verify-ui` skill)**

Invoke the `verify-ui` skill and follow it for:
- the **Societies panel and form** in the admin console, desktop (`AdminConsole`) and phone (`MobileAdminConsole`), at 320/390/430 and tablet width, in both themes. `npm run dev:web` (fake reis session, in-memory writes) is fine for layout.
- the **event detail card** and **Novinky row** with a logo, and with a failed logo (point one society's `logo` at a 404 via `useAppStore.setState` in the page).

Take before/after PNGs and send them with `SendUserFile` before claiming done (memory `verifying-ui-work`).

- [ ] **Step 4: State the verification gap in the PR**

Unless `REIS_ADMIN_EMAIL` / `REIS_ADMIN_PASSWORD` are in `.env` (check with `grep -c '^REIS_ADMIN_' .env`), the real upload/insert path is proven only by:
- the SQL claims against the stub (Task 1)
- mocked-client unit tests

Say exactly that in the PR body. `dev:web` writes go to memory and are not evidence.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin claude/societies-supabase-migration-308fe8
gh pr create --base test --title "feat(societies): societies and logos live in Supabase, managed from the admin console" --body "<summary, what changed per tree, the verification table, the gap, the runbook link, and the rollout warning>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Follow memory `github-push-identity` for the push identity, and memory `always-enable-auto-fix` right after `gh pr create`. Do **not** merge. Merging to `test` is Dominik's call (memory `park-features-as-prs-not-in-test`), and so is the runbook.
