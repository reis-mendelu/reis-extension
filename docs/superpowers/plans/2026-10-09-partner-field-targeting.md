# Partner Field Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each partner company only to students of its faculty or study programmes. Make partners, audiences and logos editable in the admin console with no code change, and count weekly users per programme.

**Architecture:**
- **Partners are rows in `societies`.** Two new columns (`kind`, `audience`) say which rows are partners and whom they reach. Two more (`mark_light_path`, `mark_dark_path`) hold their colour logos.
- **The device does the matching.** A pure module, `src/utils/partnerAudience.ts`, compares the audience with the student's faculty and base programme code. The programme is parsed on the device from IS and cached with the faculty.
- **The existing audience rule enforces it.** `canSee` hides partner events from non-matching students. A shared `PartnersBlock` renders on the phone tree (`AboutSection`) and the desktop tree (`ProfilePopup`).
- **The daily usage count gains the programme code.** A new admin RPC, `usage_programmes`, returns the per-programme breakdown.

**Tech Stack:** React 19 + TypeScript, Zustand slices, Vitest + Testing Library, Supabase (Postgres, PostgREST, Storage), DaisyUI/Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-09-partner-field-targeting-design.md`

## Global Constraints

- **Base branch.** Branch `feat/partner-field-targeting` is cut from `origin/test`. The PR targets `test` and stays parked, not merged, until Dominik decides.
- **Tests first** (CLAUDE.md "Test first").
  - Locally, run only the touched tests (`npx vitest run <pattern>`) plus `npm run typecheck`. Repo-wide lint, format and the full suite are CI's job.
  - If vitest worker handshakes time out under load, add `--no-file-parallelism --maxWorkers=1`.
- **Code rules.**
  - No `localStorage`, no `useEffect` for data fetching, no custom CSS (DaisyUI/Tailwind only), no re-export barrels.
  - Max ~200 lines per file: split before crossing it.
- **Audience token regex, used identically in SQL and TS:** `^(mendelu|pef|af|ldf|zf|frrms)(:[A-Z]-[A-Z0-9]{1,10})?$`
- **Programme code regex, used identically in SQL and TS:** `^[A-Z]-[A-Z0-9]{1,10}$`
- **The programme never leaves the device in any partner path.** It is sent only as the `p_programme` label of `track_daily_usage`. It is never attached to feature counters or event ids.
- **Parser rule.** Do not modify `src/utils/userParams/fetchers.ts`. CLAUDE.md "Parser Rules" forbids it; `studyProgram` is consumed as it is.
- **The migration is applied by hand, and only after Dominik approves** (memory: migrations-do-not-self-apply). Never run `supabase db push`.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261011120000_partner_targeting.sql` (new) | Columns, the validator, the EY backfill, programme on usage, `track_daily_usage` with `p_programme`, the `usage_programmes` RPCs |
| `src/utils/partnerAudience.ts` (new) | Pure: regexes, `baseProgramme`, `isPartner`, `matchesAudience`, `matchingPartners`, audience draft ⇄ tokens |
| `src/types/events.ts` | `Society` gains `kind?`, `audience?`, `markLight?`, `markDark?` |
| `src/api/societies.ts` | Read the new columns |
| `src/data/societies.ts` | Seed: EY is a partner for `pef` |
| `src/utils/eventAudience.ts` | `Viewer.programme`; partner rule in `canSee` |
| `src/hooks/useViewer.ts` | Pass the programme |
| `src/store/types.ts`, `src/store/slices/createContextSlice.ts`, `src/store/slices/createDemoSlice.ts` | `userProgramme` plus its cache |
| `src/api/feedback.ts` | Send `p_programme` |
| `src/components/CampusMap/EventComposer.tsx`, `ComposerAudienceField.tsx` | Force "for our people" for partners |
| `src/api/societiesAdmin.ts`, `src/store/slices/societies/saveSociety.ts`, `src/store/slices/createSocietiesSlice.ts` | Write `kind`, `audience` and the marks |
| `src/utils/societies/encodePartnerMark.ts` (new) | Transparent wide-mark encoder |
| `src/components/AdminConsole/PartnerFields.tsx` (new) | Type switch, audience editor, mark uploads, `usePartnerDraft` |
| `src/components/AdminConsole/SocietyForm.tsx` | Mount `PartnerFields` |
| `src/api/usageProgrammes.ts` (new), `src/store/slices/createAdminStatsSlice.ts`, `src/components/AdminConsole/AdminStatsPanel.tsx` | Programme breakdown |
| `src/hooks/useMatchingPartners.ts` (new) | Store plus viewer → partners |
| `src/components/brand/PartnerMark.tsx` (new) | One partner's mark (light/dark, EY fallback) |
| `src/components/Partners/PartnersBlock.tsx` (new) | The shared block |
| `src/components/mobile/screens/profile/AboutSection.tsx`, `src/components/Sidebar/ProfilePopup.tsx` | Mount the block on both trees |
| `src/test/guards/partnersBlockOnBothTrees.test.ts` (new) | Pins the block to both trees |
| `src/i18n/locales/{cs,en}.json` | New keys; `about.eyBody` removed |
| `privacy/disclosures.ts`, `PRIVACY.md`, `docs/privacy-policy-app.md`, `CLAUDE.md`, `scripts/appHealth.ts` | Disclosure of the programme label; the new read-only RPC |

`autoFollowSocietyFor` (`resolveSociety.ts`) has no production caller (follows are gone), so it is not touched. This supersedes the spec's auto-follow bullet.

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261011120000_partner_targeting.sql`

**Interfaces:**
- **Produces columns.**
  - `societies.kind`, `societies.audience text[]`, `societies.mark_light_path`, `societies.mark_dark_path`.
  - `daily_active_usage.programme`.
- **Produces functions.**
  - `track_daily_usage(p_student_id text, p_faculty text default null, p_platform text default null, p_programme text default null)`.
  - `usage_programmes(p_days int) returns json`, an array of `{key, devices}`. `key` is `"<FACULTY> <PROGRAMME>"` or `"<FACULTY> ?"`, and `devices = -1` means under 5.

- [ ] **Step 1: Read the production definitions (read-only).**

Create the scratch file `$SCRATCH/defs.sql`:
```sql
select pg_get_functiondef('public.track_daily_usage(text,text,text)'::regprocedure);
select pg_get_functiondef('public.usage_stats_unchecked(int,date)'::regprocedure);
```
Run `npx supabase db query --linked -f "$SCRATCH/defs.sql"`.
Expected: the `track_daily_usage` body equals the one in `supabase/migrations/20260915130000_usage_stats_devices.sql` lines 16–35, with the Prague day, `v_faculty` and `v_platform`. Note the reporting filter `usage_stats_unchecked` uses: the epoch date and the `platform` exclusion. If either differs from the SQL below, copy production's logic into Step 2 instead.

- [ ] **Step 2: Write the migration.**

```sql
-- Partner field targeting (spec docs/superpowers/specs/2026-10-09-partner-field-targeting-design.md).
-- A partner is a societies row with kind = 'partner' and an audience: faculty
-- tokens ('pef') or faculty:programme tokens ('pef:B-OI'). The app matches the
-- audience ON THE DEVICE; nothing about a student reaches a partner.
-- Additive and defaulted: released builds select explicit columns and ignore these.

create or replace function public.societies_audience_valid(p text[])
returns boolean language sql immutable as $$
  select p is null or (
    cardinality(p) > 0 and not exists (
      select 1 from unnest(p) t
       where t !~ '^(mendelu|pef|af|ldf|zf|frrms)(:[A-Z]-[A-Z0-9]{1,10})?$'))
$$;

alter table public.societies
  add column if not exists kind text not null default 'society'
    check (kind in ('society','partner')),
  add column if not exists audience text[]
    check (public.societies_audience_valid(audience)),
  add column if not exists mark_light_path text
    check (mark_light_path is null or mark_light_path ~ ('^' || id || '/[0-9a-f]{32}\.png$')),
  add column if not exists mark_dark_path text
    check (mark_dark_path is null or mark_dark_path ~ ('^' || id || '/[0-9a-f]{32}\.png$'));

alter table public.societies
  add constraint societies_partner_has_audience check (kind <> 'partner' or audience is not null);

-- EY was the first partner, shown to all of PEF; that stays exactly as it is.
update public.societies set kind = 'partner', audience = '{pef}' where id = 'ey';

-- Programme on the anonymous daily count: the BASE study-programme code (B-OI,
-- not B-OI-ZBOI), an aggregate label like faculty. Checked at the column so no
-- write path can store an arbitrary string.
alter table public.daily_active_usage
  add column if not exists programme text
    check (programme is null or programme ~ '^[A-Z]-[A-Z0-9]{1,10}$');

-- One function must remain: two overloads would make PostgREST's named-argument
-- dispatch ambiguous for the 1- and 3-argument calls released clients make.
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'track_daily_usage'
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

create or replace function public.track_daily_usage(
  p_student_id text,
  p_faculty text default null,
  p_platform text default null,
  p_programme text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := case when upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
  v_programme text := case when upper(btrim(coalesce(p_programme, ''))) ~ '^[A-Z]-[A-Z0-9]{1,10}$'
                       then upper(btrim(p_programme)) end;
  v_day date := (now() at time zone 'Europe/Prague')::date;
begin
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform, programme)
  values (p_student_id, v_day, 1, v_faculty, v_platform, v_programme)
  on conflict (student_id, usage_date) do update
    set open_count = public.daily_active_usage.open_count + 1,
        faculty    = coalesce(excluded.faculty,   public.daily_active_usage.faculty),
        platform   = coalesce(excluded.platform,  public.daily_active_usage.platform),
        programme  = coalesce(excluded.programme, public.daily_active_usage.programme);
end $$;
revoke all on function public.track_daily_usage(text, text, text, text) from public;
grant execute on function public.track_daily_usage(text, text, text, text) to anon, authenticated;

-- Devices per faculty+programme over the window. '?' = faculty known, programme
-- not sent (a build older than this) or not parsed. Same reporting filter as
-- usage_stats_unchecked (epoch 2026-09-07, web excluded) and the same
-- suppression helper, so a programme under 5 devices shows as -1.
create or replace function public.usage_programmes_unchecked(p_days int)
returns json language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Europe/Prague')::date as d),
  shown as (
    select u.student_id, u.faculty, u.programme
      from public.daily_active_usage u, today
     where u.usage_date >= greatest(today.d - (p_days - 1), date '2026-09-07')
       and u.platform is distinct from 'web'
       and u.faculty is not null
  ),
  per_device as (
    select student_id, faculty, max(programme) as programme
      from shown group by student_id, faculty
  ),
  grouped as (
    select faculty || ' ' || coalesce(programme, '?') as key, count(*) as n
      from per_device group by 1
  )
  select public.usage_suppress_groups(
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from grouped), '[]'::jsonb));
$$;
revoke all on function public.usage_programmes_unchecked(int) from public, anon, authenticated;

create or replace function public.usage_programmes(p_days int)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_programmes_unchecked(p_days);
end $$;
revoke all on function public.usage_programmes(int) from public, anon;
grant execute on function public.usage_programmes(int) to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 3: Verify locally.**

Follow memory `verify-supabase-sql-locally`: stub Postgres plus the earlier migrations that define `societies`, `daily_active_usage`, `get_my_role` and `usage_suppress_groups`. Then apply this file and run:
```sql
-- valid / invalid audience
insert into public.societies (id,name,short_name,color,faculty_key,auto_follow_faculty,sort_order,kind,audience)
values ('t1','T','T','#000000','pef',false,1,'partner','{pef:B-OI,frrms}');          -- ok
insert into public.societies (id,name,short_name,color,faculty_key,auto_follow_faculty,sort_order,kind,audience)
values ('t2','T','T','#000000','pef',false,1,'partner','{pef:b-oi}');                 -- must FAIL (lower case)
insert into public.societies (id,name,short_name,color,faculty_key,auto_follow_faculty,sort_order,kind)
values ('t3','T','T','#000000','pef',false,1,'partner');                              -- must FAIL (no audience)
select kind, audience from public.societies where id = 'ey';                          -- partner, {pef}
select count(*) from pg_proc where proname = 'track_daily_usage';                     -- 1
select public.track_daily_usage('a', 'PEF', 'ios');                                   -- old 3-arg call works
select public.track_daily_usage('a', 'PEF', 'ios', 'b-oi');                           -- normalised to B-OI
select public.track_daily_usage('a', 'PEF', 'ios', null);                             -- keeps B-OI
select programme from public.daily_active_usage where student_id = 'a';               -- B-OI
select public.track_daily_usage('b', 'PEF', 'ios', 'garbage!');                       -- stored null
select public.usage_programmes_unchecked(30);                                         -- groups, small ones -1
```
Expected: each comment holds.

- [ ] **Step 4: Commit.**
```bash
git add supabase/migrations/20261011120000_partner_targeting.sql
git commit -m "feat(db): partner audience, partner marks, programme on daily usage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pure audience module

**Files:**
- Create: `src/utils/partnerAudience.ts`
- Test: `src/utils/__tests__/partnerAudience.test.ts`
- Modify: `src/types/events.ts` (the `Society` interface)

**Interfaces:**
- **Consumes:** `FacultyKey`, `Society` from `src/types/events.ts`.
- **Produces:**
  - `AUDIENCE_TOKEN_RE: RegExp`, `PROGRAMME_RE: RegExp`
  - `baseProgramme(code: string | null | undefined): string | null`
  - `isPartner(s: Society | undefined): boolean`
  - `interface AudienceViewer { facultyKey: FacultyKey | null; programme?: string | null }`
  - `matchesAudience(audience: readonly string[] | null | undefined, viewer: AudienceViewer): boolean`
  - `matchingPartners(catalog: Record<string, Society>, viewer: AudienceViewer): Society[]`
  - `type AudienceDraft = Partial<Record<FacultyKey, string>>`: a key present means the chip is on; its value is the comma list of programmes, `''` for the whole faculty.
  - `audienceFromDraft(draft: AudienceDraft): string[] | 'invalid'`
  - `draftFromAudience(audience: readonly string[] | null | undefined): AudienceDraft`
  - `Society` gains `kind?: 'society' | 'partner'; audience?: string[] | null; markLight?: string; markDark?: string;`

- [ ] **Step 1: Add the optional fields to `Society`** in `src/types/events.ts`, after `instagram?: string;`:
```ts
  /** 'partner' = a company shown only to its audience (spec 2026-10-09). Absent = society. */
  kind?: 'society' | 'partner';
  /** Partner audience: 'pef' (whole faculty) or 'pef:B-OI' (one programme). */
  audience?: string[] | null;
  /** Public URL of the partner's transparent colour mark for light mode. */
  markLight?: string;
  /** Optional dark-mode mark; the light one is used when absent. */
  markDark?: string;
```

- [ ] **Step 2: Write the failing test** `src/utils/__tests__/partnerAudience.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Society } from '../../types/events';
import {
  AUDIENCE_TOKEN_RE,
  audienceFromDraft,
  baseProgramme,
  draftFromAudience,
  isPartner,
  matchesAudience,
  matchingPartners,
} from '../partnerAudience';

const partner = (id: string, audience: string[], sortOrder = 1, isActive = true): Society => ({
  id, name: id, shortName: id, color: '#000000', glyph: id, facultyKey: 'pef',
  autoFollowFaculty: false, audienceLabel: null, sortOrder, isActive, kind: 'partner', audience,
});

describe('baseProgramme', () => {
  it.each([
    ['B-OI', 'B-OI'],
    ['B-OI-ZBOI', 'B-OI'],
    ['b-aii', 'B-AII'],
    [' N-EM-FR ', 'N-EM'],
    ['OI', null],
    ['', null],
    [null, null],
    [undefined, null],
    ['B-!!', null],
  ])('%s → %s', (input, expected) => {
    expect(baseProgramme(input)).toBe(expected);
  });
});

describe('AUDIENCE_TOKEN_RE (must equal the SQL CHECK)', () => {
  it.each(['pef', 'mendelu', 'frrms', 'pef:B-OI', 'ldf:B-SBD', 'af:N-Z10'])('accepts %s', (t) => {
    expect(AUDIENCE_TOKEN_RE.test(t)).toBe(true);
  });
  it.each(['PEF', 'pef:b-oi', 'pef:', 'xyz', 'pef:B-', 'pef:BOI', 'pef:B-OI-ZBOI'])('rejects %s', (t) => {
    expect(AUDIENCE_TOKEN_RE.test(t)).toBe(false);
  });
});

describe('matchesAudience', () => {
  const pefOi = { facultyKey: 'pef' as const, programme: 'B-OI' };
  const pefEm = { facultyKey: 'pef' as const, programme: 'B-EM' };
  const pefUnknownProg = { facultyKey: 'pef' as const, programme: null };
  const frrms = { facultyKey: 'frrms' as const, programme: 'B-RR' };
  const nobody = { facultyKey: null, programme: null };

  it('a faculty token matches every programme of that faculty', () => {
    expect(matchesAudience(['pef'], pefEm)).toBe(true);
    expect(matchesAudience(['pef'], pefUnknownProg)).toBe(true);
    expect(matchesAudience(['pef'], frrms)).toBe(false);
  });
  it('a programme token matches only that programme of that faculty', () => {
    expect(matchesAudience(['pef:B-OI'], pefOi)).toBe(true);
    expect(matchesAudience(['pef:B-OI'], pefEm)).toBe(false);
    expect(matchesAudience(['pef:B-OI'], pefUnknownProg)).toBe(false);
    expect(matchesAudience(['frrms:B-OI'], pefOi)).toBe(false);
  });
  it('mendelu matches every student whose faculty is known', () => {
    expect(matchesAudience(['mendelu'], frrms)).toBe(true);
    expect(matchesAudience(['mendelu'], nobody)).toBe(false);
  });
  it('any matching token is enough', () => {
    expect(matchesAudience(['frrms', 'pef:B-OI'], pefOi)).toBe(true);
  });
  it('no audience or an unknown faculty matches nothing', () => {
    expect(matchesAudience(null, pefOi)).toBe(false);
    expect(matchesAudience([], pefOi)).toBe(false);
    expect(matchesAudience(['pef'], nobody)).toBe(false);
  });
});

describe('isPartner / matchingPartners', () => {
  it('only kind partner is a partner', () => {
    expect(isPartner(partner('ey', ['pef']))).toBe(true);
    expect(isPartner({ ...partner('esn', ['pef']), kind: 'society' })).toBe(false);
    expect(isPartner(undefined)).toBe(false);
  });
  it('lists active matching partners in sort order', () => {
    const cat = {
      b: partner('b', ['pef'], 20),
      a: partner('a', ['pef:B-OI'], 10),
      c: partner('c', ['frrms'], 5),
      d: partner('d', ['pef'], 1, false),
      s: { ...partner('s', ['pef'], 0), kind: 'society' as const },
    };
    expect(matchingPartners(cat, { facultyKey: 'pef', programme: 'B-OI' }).map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('audience draft round trip', () => {
  it('chips and programme lists become tokens', () => {
    expect(audienceFromDraft({ frrms: '', pef: 'b-oi, N-OI  B-AII' })).toEqual([
      'frrms', 'pef:B-OI', 'pef:N-OI', 'pef:B-AII',
    ]);
  });
  it('an empty draft or a bad code is invalid', () => {
    expect(audienceFromDraft({})).toBe('invalid');
    expect(audienceFromDraft({ pef: 'B_OI' })).toBe('invalid');
  });
  it('tokens become a draft', () => {
    expect(draftFromAudience(['frrms', 'pef:B-OI', 'pef:N-OI'])).toEqual({ frrms: '', pef: 'B-OI, N-OI' });
    expect(draftFromAudience(null)).toEqual({});
  });
});
```

- [ ] **Step 3: Run it to confirm it fails.**
Run: `npx vitest run src/utils/__tests__/partnerAudience.test.ts`
Expected: FAIL, "Failed to resolve import ../partnerAudience".

- [ ] **Step 4: Implement** `src/utils/partnerAudience.ts`:
```ts
import { ORGANIZERS, type FacultyKey, type Society } from '../types/events';

/**
 * Who a partner company is shown to (spec 2026-10-09). Matching happens on the
 * student's device; a partner never learns who matched. Both regexes must stay
 * identical to the CHECKs in supabase/migrations/20261011120000_partner_targeting.sql.
 */
export const AUDIENCE_TOKEN_RE = /^(mendelu|pef|af|ldf|zf|frrms)(:[A-Z]-[A-Z0-9]{1,10})?$/;
export const PROGRAMME_RE = /^[A-Z]-[A-Z0-9]{1,10}$/;

/** 'B-OI-ZBOI' → 'B-OI'. Null when the code is missing or not programme-shaped. */
export function baseProgramme(code: string | null | undefined): string | null {
  if (!code) return null;
  const [level, programme] = code.trim().toUpperCase().split('-');
  if (!level || !programme) return null;
  const base = `${level}-${programme}`;
  return PROGRAMME_RE.test(base) ? base : null;
}

export function isPartner(society: Society | undefined): boolean {
  return society?.kind === 'partner';
}

export interface AudienceViewer {
  facultyKey: FacultyKey | null;
  programme?: string | null;
}

/** Any token matching is enough. An unknown faculty matches nothing. */
export function matchesAudience(
  audience: readonly string[] | null | undefined,
  viewer: AudienceViewer
): boolean {
  if (!audience?.length || !viewer.facultyKey) return false;
  return audience.some((token) => {
    const [faculty, programme] = token.split(':');
    if (faculty === 'mendelu') return true;
    if (faculty !== viewer.facultyKey) return false;
    return programme === undefined || programme === (viewer.programme ?? null);
  });
}

export function matchingPartners(
  catalog: Record<string, Society>,
  viewer: AudienceViewer
): Society[] {
  return Object.values(catalog)
    .filter((s) => s.isActive && isPartner(s) && matchesAudience(s.audience, viewer))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Admin form state: a key present = chip on; value = comma list ('' = whole faculty). */
export type AudienceDraft = Partial<Record<FacultyKey, string>>;

export function audienceFromDraft(draft: AudienceDraft): string[] | 'invalid' {
  const tokens: string[] = [];
  // The draft's own key order, so tokens come out in the order the admin set them.
  for (const faculty of Object.keys(draft) as FacultyKey[]) {
    if (!(faculty in ORGANIZERS)) return 'invalid';
    const list = draft[faculty];
    if (list === undefined) continue;
    const codes = list.split(/[,\s]+/).filter(Boolean).map((c) => c.toUpperCase());
    if (codes.length === 0) tokens.push(faculty);
    else tokens.push(...codes.map((c) => `${faculty}:${c}`));
  }
  if (tokens.length === 0 || !tokens.every((t) => AUDIENCE_TOKEN_RE.test(t))) return 'invalid';
  return tokens;
}

export function draftFromAudience(audience: readonly string[] | null | undefined): AudienceDraft {
  const draft: AudienceDraft = {};
  for (const token of audience ?? []) {
    const [faculty, programme] = token.split(':') as [FacultyKey, string | undefined];
    const prev = draft[faculty];
    if (!programme) draft[faculty] = prev ?? '';
    else draft[faculty] = prev ? `${prev}, ${programme}` : programme;
  }
  return draft;
}
```
- [ ] **Step 5: Run the test to confirm it passes.**
Run: `npx vitest run src/utils/__tests__/partnerAudience.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add src/utils/partnerAudience.ts src/utils/__tests__/partnerAudience.test.ts src/types/events.ts
git commit -m "feat(partners): pure audience matching and programme base code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Read the new columns, and seed EY as a partner

**Files:**
- Modify: `src/api/societies.ts` (`SocietyRow`, `SOCIETY_COLUMNS`, `rowToSociety`)
- Modify: `src/data/societies.ts` (the `ey` seed)
- Modify: `src/api/societiesAdmin.ts` (`devRow` defaults)
- Test: `src/api/__tests__/societies.test.ts`

**Interfaces:**
- **Consumes:** the `Society` fields from Task 2.
- **Produces:**
  - `SocietyRow` gains `kind: string; audience: string[] | null; mark_light_path: string | null; mark_dark_path: string | null`.
  - `rowToSociety` maps them. An unknown `kind` reads as `'society'`. The mark URLs use `logoPublicUrl`.

- [ ] **Step 1: Write the failing tests.** Append to `src/api/__tests__/societies.test.ts`. Reuse the file's existing complete-row fixture; if it is named differently, adapt `baseRow` to it.
```ts
describe('rowToSociety: partner columns', () => {
  const baseRow = {
    id: 'kpmg', name: 'KPMG', short_name: 'KPMG', color: '#00338d', faculty_key: 'frrms',
    auto_follow_faculty: false, audience_label: null, logo_path: null, sort_order: 90,
    is_active: true, instagram: null, kind: 'partner', audience: ['frrms'],
    mark_light_path: 'kpmg/0123456789abcdef0123456789abcdef.png', mark_dark_path: null,
  };
  it('maps kind, audience and marks', () => {
    const s = rowToSociety(baseRow)!;
    expect(s.kind).toBe('partner');
    expect(s.audience).toEqual(['frrms']);
    expect(s.markLight).toMatch(/society-logos\/kpmg\/0123/);
    expect(s.markDark).toBeUndefined();
  });
  it('reads an unknown kind as a society', () => {
    expect(rowToSociety({ ...baseRow, kind: 'sponsor' })!.kind).toBe('society');
  });
});
```
Also add to `src/data/__tests__/societies.test.ts`:
```ts
it('EY is seeded as a PEF-wide partner', () => {
  expect(BUNDLED_SOCIETIES.ey!.kind).toBe('partner');
  expect(BUNDLED_SOCIETIES.ey!.audience).toEqual(['pef']);
});
```

- [ ] **Step 2: Run them to confirm they fail.**
Run: `npx vitest run src/api/__tests__/societies.test.ts src/data/__tests__/societies.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `src/api/societies.ts`:
```ts
export interface SocietyRow {
  // ...existing fields...
  kind: string;
  audience: string[] | null;
  mark_light_path: string | null;
  mark_dark_path: string | null;
}

export const SOCIETY_COLUMNS =
  'id, name, short_name, color, faculty_key, auto_follow_faculty, audience_label, logo_path, sort_order, is_active, instagram, kind, audience, mark_light_path, mark_dark_path';
```
In `rowToSociety`'s returned object, after `instagram`:
```ts
    kind: row.kind === 'partner' ? 'partner' : 'society',
    audience: row.audience ?? null,
    ...(row.mark_light_path ? { markLight: logoPublicUrl(row.mark_light_path) } : {}),
    ...(row.mark_dark_path ? { markDark: logoPublicUrl(row.mark_dark_path) } : {}),
```
In `src/data/societies.ts`, inside `ey: seed({ ... })`, add `kind: 'partner', audience: ['pef'],`.
In `src/api/societiesAdmin.ts` `devRow`, add the defaults `kind: 'society', audience: null, mark_light_path: null, mark_dark_path: null,` before `...row`.

- [ ] **Step 4: Run the tests, plus the existing society suites.**
Run: `npx vitest run src/api/__tests__/societies src/data/__tests__/societies src/api/__tests__/societiesAdmin`
Expected: PASS. If an existing `SocietyRow` fixture now fails typecheck because it lacks the new fields, add the four fields to that fixture.

- [ ] **Step 5: Commit.**
```bash
git add src/api/societies.ts src/api/societiesAdmin.ts src/data/societies.ts src/api/__tests__ src/data/__tests__
git commit -m "feat(partners): read kind, audience and marks; EY seeded as PEF partner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The viewer knows its programme, and partner events obey the audience

**Files:**
- Modify: `src/utils/eventAudience.ts`, `src/hooks/useViewer.ts`, `src/store/types.ts` (ContextSlice, around line 382), `src/store/slices/createContextSlice.ts`, `src/store/slices/createDemoSlice.ts:111`
- Test: `src/utils/__tests__/eventAudience.test.ts`, `src/store/slices/__tests__/createContextSlice.test.ts` (create it if absent)

**Interfaces:**
- **Consumes:** `isPartner`, `matchesAudience`, `baseProgramme` (Task 2).
- **Produces:**
  - `Viewer` gains `programme?: string | null`.
  - `viewerFrom(facultyLabel: string | null, erasmus: boolean, programme?: string | null): Viewer`.
  - The store gains `userProgramme: string | null`.

- [ ] **Step 1: Write the failing tests.** Append to `src/utils/__tests__/eventAudience.test.ts`:
```ts
describe('canSee: partners obey their audience, whatever subscribersOnly says', () => {
  const sap = {
    ...cat.ey!, id: 'sap', kind: 'partner' as const, audience: ['pef:B-OI', 'pef:B-AII'],
  };
  const withSap = { ...cat, sap };
  const pefOi: Viewer = { facultyKey: 'pef', erasmus: false, programme: 'B-OI' };
  const pefEm: Viewer = { facultyKey: 'pef', erasmus: false, programme: 'B-EM' };

  it('shows a public partner event only to matching students', () => {
    expect(canSee(ev('sap', false), withSap, pefOi)).toBe(true);
    expect(canSee(ev('sap', false), withSap, pefEm)).toBe(false);
    expect(canSee(ev('sap', false), withSap, frrms)).toBe(false);
    expect(canSee(ev('sap', false), withSap, unknown)).toBe(false);
  });
  it('a restricted partner event follows the same audience', () => {
    expect(canSee(ev('sap', true), withSap, pefOi)).toBe(true);
    expect(canSee(ev('sap', true), withSap, pefEm)).toBe(false);
  });
  it('societies keep their faculty rule', () => {
    expect(canSee(ev('supef', false), withSap, frrms)).toBe(true);
    expect(canSee(ev('supef', true), withSap, frrms)).toBe(false);
  });
});
```
Note: `cat.ey` is now a PEF partner (Task 3). Find any existing assertion in this file of the form `canSee(ev('ey', false), cat, frrms) === true` and change it to `false`, with the comment `// EY is a PEF partner since 2026-10-09`.

Create or extend `src/store/slices/__tests__/createContextSlice.test.ts`, mirroring how the other slice tests mock `getUserParams` and `IndexedDBService`. Copy the `vi.mock` lines from an existing slice test that mocks `../../../utils/userParams`.
```ts
it('stores the base programme from IS and caches it with the faculty', async () => {
  vi.mocked(getUserParams).mockResolvedValue({
    studium: '1', obdobi: '1', facultyId: '', username: 'x', studentId: '1', fullName: 'X',
    facultyLabel: 'PEF', studyProgram: 'B-OI-ZBOI', isErasmus: false,
  });
  await useAppStore.getState().loadContext();
  expect(useAppStore.getState().userProgramme).toBe('B-OI');
  expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'viewer_audience',
    expect.objectContaining({ faculty: 'PEF', programme: 'B-OI' }));
});
it('restores the cached programme on a cold start', async () => {
  vi.mocked(IndexedDBService.get).mockResolvedValue({ faculty: 'PEF', erasmus: false, programme: 'B-OI', savedAt: Date.now() });
  vi.mocked(getUserParams).mockResolvedValue(null);
  useAppStore.setState({ userFaculty: null, userProgramme: null });
  await useAppStore.getState().loadContext();
  expect(useAppStore.getState().userProgramme).toBe('B-OI');
});
```

- [ ] **Step 2: Run them to confirm they fail.**
Run: `npx vitest run src/utils/__tests__/eventAudience.test.ts src/store/slices/__tests__/createContextSlice.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

In `src/utils/eventAudience.ts`, add `import { isPartner, matchesAudience } from './partnerAudience';`. Extend `Viewer`:
```ts
  /** Base study-programme code ('B-OI'), null when IS did not say. Partners only. */
  programme?: string | null;
```
In `canSee`, put this as the first lines of the body:
```ts
  const society = societies[event.societyId];
  // Partners reach their audience and nobody else, whatever the event's own flag.
  if (isPartner(society)) return matchesAudience(society!.audience, viewer);
  if (!event.subscribersOnly) return true;
```
Then delete the later duplicate `const society = ...` line.

In `src/hooks/useViewer.ts`:
```ts
export function viewerFrom(facultyLabel: string | null, erasmus: boolean, programme: string | null = null): Viewer {
  return { facultyKey: (facultyLabel && FACULTY_LABEL_TO_KEY[facultyLabel]) || null, erasmus, programme };
}
```
Inside `useViewer`, add `const programme = useAppStore((s) => s.userProgramme);`. Change the non-impersonated branch to `viewerFrom(own, erasmus, programme)` and add `programme` to the deps array. The impersonated branch stays `viewerFrom(impersonated, false)`, so its programme is null.

In `src/store/types.ts` ContextSlice, next to `userFaculty: string | null;`:
```ts
  /** Base study-programme code from IS ('B-OI'); partner targeting only, never sent with it. */
  userProgramme: string | null;
```
In `createContextSlice.ts`:
- Import `baseProgramme`.
- Add the initial `userProgramme: null,`.
- Cache read: type the cached record as `{ faculty: string | null; erasmus: boolean; programme?: string | null; savedAt?: number }`, and set `userProgramme: cached.programme ?? null` in the same `set`.
- In the IS branch's `set`, add `userProgramme: baseProgramme(params.studyProgram) ?? get().userProgramme,`.
- In the IDB write, add `programme: baseProgramme(params.studyProgram),`.

In `createDemoSlice.ts`, next to `userFaculty: null,`, add `userProgramme: null,`.

- [ ] **Step 4: Run the tests and the typecheck.**
Run: `npx vitest run src/utils/__tests__/eventAudience.test.ts src/store/slices/__tests__/createContextSlice.test.ts src/hooks && npm run typecheck`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit.**
```bash
git add src/utils/eventAudience.ts src/hooks/useViewer.ts src/store src/utils/__tests__/eventAudience.test.ts
git commit -m "feat(partners): partner events reach only their audience; viewer knows its programme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The daily count sends the base programme

**Files:**
- Modify: `src/api/feedback.ts` (`writeDailyUsage`, around lines 118–134)
- Test: the existing test of `trackDailyUsage`. Find it with `grep -rln "track_daily_usage" src --include=*.test.ts`.

**Interfaces:**
- **Consumes:** `baseProgramme` (Task 2).
- **Produces:** the RPC args `{ p_student_id, p_faculty, p_platform, p_programme }`.

- [ ] **Step 1: Write the failing test.** In that test file, next to the existing faculty assertion, using its own `rpc` mock and `getUserParams` mock:
```ts
it('sends the base programme code beside the faculty', async () => {
  vi.mocked(getUserParams).mockResolvedValue({ ...PARAMS, facultyLabel: 'PEF', studyProgram: 'B-OI-ZBOI' });
  await trackDailyUsage();
  expect(rpc).toHaveBeenCalledWith('track_daily_usage', expect.objectContaining({ p_programme: 'B-OI' }));
});
it('sends null when IS gave no parsable programme', async () => {
  vi.mocked(getUserParams).mockResolvedValue({ ...PARAMS, facultyLabel: 'PEF', studyProgram: undefined });
  await trackDailyUsage();
  expect(rpc).toHaveBeenCalledWith('track_daily_usage', expect.objectContaining({ p_programme: null }));
});
```
`PARAMS`, `rpc` and the reset of the module memo are whatever that file already uses. Match them.

- [ ] **Step 2: Run it to confirm it fails.** Run: `npx vitest run <that test file>`. Expected: FAIL.

- [ ] **Step 3: Implement.** In `writeDailyUsage`:
```ts
  const params = await getUserParams();
  const faculty = params?.facultyLabel ?? null;
  // The base code only ('B-OI', never 'B-OI-ZBOI'): an aggregate label like
  // faculty, disclosed in privacy/disclosures.ts. Never sent anywhere else.
  const programme = baseProgramme(params?.studyProgram);
```
Replace the old `const faculty = (await getUserParams())?.facultyLabel ?? null;`. Add `p_programme: programme,` to the `rpc` args, and add the `baseProgramme` import.

- [ ] **Step 4: Run the test to confirm it passes.** Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/api/feedback.ts <test file>
git commit -m "feat(usage): daily count carries the base programme code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The composer always restricts partner events

**Files:**
- Modify: `src/components/CampusMap/EventComposer.tsx` (around line 118), `src/components/CampusMap/ComposerAudienceField.tsx`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`, adding `map.partnerAudienceHint`
- Test: `src/components/CampusMap/__tests__/ComposerAudienceField.test.tsx` (create it, or extend the existing composer test)

**Interfaces:**
- **Consumes:** `isPartner`.

- [ ] **Step 1: Write the failing test.**
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { ComposerAudienceField } from '../ComposerAudienceField';

describe('ComposerAudienceField for a partner', () => {
  beforeEach(() => useAppStore.setState({ societies: BUNDLED_SOCIETIES }));
  it('shows a fixed note instead of the checkbox', () => {
    render(<ComposerAudienceField societyId="ey" value={false} onChange={() => {}} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(/obor|field/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails.** Expected: FAIL, because the checkbox is rendered for EY.

- [ ] **Step 3: Implement.** In `ComposerAudienceField`, after reading `society`:
```tsx
  if (isPartner(society)) {
    // A partner's audience is set in the console, not per event: every event
    // goes to that audience only (spec 2026-10-09).
    return <p className="mt-3 text-xs text-base-content/70">{t('map.partnerAudienceHint')}</p>;
  }
```
In `EventComposer.tsx`, read `const authorIsPartner = useAppStore((s) => isPartner(s.societies[associationId ?? '']));`. Change the submitted flag to:
```ts
      // Partners are always restricted: released builds without the audience
      // rule then show the event only to the partner's faculty, never to all.
      subscribersOnly: authorIsPartner || (!cannotRestrict && subscribersOnly),
```
i18n:
- cs: `"partnerAudienceHint": "Akci uvidí jen studenti oborů, pro které je partner nastavený."`
- en: `"partnerAudienceHint": "Only students of the fields this partner is set up for will see this event."`

Put both under the existing `map` object.

- [ ] **Step 4: Run the test and the existing composer tests.**
Run: `npx vitest run src/components/CampusMap`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/components/CampusMap src/i18n/locales
git commit -m "feat(partners): partner events are always audience-restricted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The admin console edits kind, audience and marks

**Files:**
- Create: `src/utils/societies/encodePartnerMark.ts`, `src/components/AdminConsole/PartnerFields.tsx`
- Modify: `src/api/societiesAdmin.ts` (`SocietyInput`, `insertSociety`), `src/store/slices/societies/saveSociety.ts`, `src/store/slices/createSocietiesSlice.ts` (the `saveSociety` action passes `marks`), `src/components/AdminConsole/SocietyForm.tsx`, the locales
- Test: `src/utils/societies/__tests__/encodePartnerMark.test.ts`, `src/store/slices/societies/__tests__/saveSociety.test.ts` (extend it), `src/components/AdminConsole/__tests__/PartnerFields.test.tsx`

**Interfaces:**
- **Consumes:** `audienceFromDraft`, `draftFromAudience`, `AudienceDraft` (Task 2); `uploadSocietyLogo` (existing).
- **Produces:**
  - `SocietyInput` gains `kind?: 'society' | 'partner'; audience?: string[] | null`.
  - `interface PartnerMarks { light: Blob | null; dark: Blob | null }`, exported from `saveSociety.ts`.
  - `saveSociety(access, input, logo, isNew, marks?: PartnerMarks)`.
  - `usePartnerDraft(society?: Society)` returns `{ kind, setKind, draft, setDraft, light, setLight, dark, setDark, validate(): string | null, toInput(): { kind: 'society' | 'partner'; audience: string[] | null }, marks: PartnerMarks }`.

- [ ] **Step 1: Write the failing encoder test.**
```ts
import { describe, it, expect } from 'vitest';
import { fitWithin, MARK_MAX_W, MARK_MAX_H } from '../encodePartnerMark';

describe('fitWithin', () => {
  it('shrinks a wide logo to the width cap, keeping the aspect', () => {
    expect(fitWithin(1200, 300, MARK_MAX_W, MARK_MAX_H)).toEqual({ w: 480, h: 120 });
  });
  it('shrinks a tall logo to the height cap', () => {
    expect(fitWithin(400, 800, MARK_MAX_W, MARK_MAX_H)).toEqual({ w: 80, h: 160 });
  });
  it('never enlarges', () => {
    expect(fitWithin(100, 40, MARK_MAX_W, MARK_MAX_H)).toEqual({ w: 100, h: 40 });
  });
});
```

- [ ] **Step 2: Implement** `src/utils/societies/encodePartnerMark.ts`:
```ts
export const MARK_MAX_W = 480;
export const MARK_MAX_H = 160;

export function fitWithin(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const s = Math.min(1, maxW / w, maxH / h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/**
 * A partner's wide colour mark: aspect kept (never cropped square like a
 * society logo), at most 480×160, PNG so transparency survives. Re-drawing
 * drops the original's metadata, as encodeSocietyLogo does.
 */
export async function encodePartnerMark(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { w, h } = fitWithin(bitmap.width, bitmap.height, MARK_MAX_W, MARK_MAX_H);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    return blob;
  } finally {
    bitmap.close();
  }
}
```
Run `npx vitest run src/utils/societies/__tests__/encodePartnerMark.test.ts`. Expected: PASS.

- [ ] **Step 3: Write the failing save test.** Extend `saveSociety.test.ts`, using its existing mocks of `../../../api/societiesAdmin` and the `encodeSocietyLogo` mock pattern. Add `vi.mock('../../../../utils/societies/encodePartnerMark', () => ({ encodePartnerMark: vi.fn(async (b: Blob) => b) }))`.
```ts
it('uploads partner marks and writes kind, audience and mark paths', async () => {
  vi.mocked(uploadSocietyLogo)
    .mockResolvedValueOnce('kpmg/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png')   // light mark
    .mockResolvedValueOnce('kpmg/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png');  // dark mark
  vi.mocked(updateSociety).mockResolvedValue(KPMG_SOCIETY);
  const res = await saveSociety(access,
    { ...KPMG_INPUT, kind: 'partner', audience: ['frrms'] }, null, false,
    { light: new Blob(['l']), dark: new Blob(['d']) });
  expect(res).toEqual({});
  expect(updateSociety).toHaveBeenCalledWith('kpmg', expect.objectContaining({
    kind: 'partner', audience: ['frrms'],
    mark_light_path: 'kpmg/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
    mark_dark_path: 'kpmg/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png',
  }));
});
it('a failed mark upload saves nothing', async () => {
  vi.mocked(uploadSocietyLogo).mockResolvedValueOnce(null);
  const res = await saveSociety(access, { ...KPMG_INPUT, kind: 'partner', audience: ['frrms'] }, null, false,
    { light: new Blob(['l']), dark: null });
  expect(res).toEqual({ error: 'upload_failed' });
  expect(updateSociety).not.toHaveBeenCalled();
});
```
Define `KPMG_INPUT` (a `SocietyInput` with id `'kpmg'`) and `KPMG_SOCIETY` (a `Society`) at the top of the new describe block, in the shape of the file's existing fixtures.

- [ ] **Step 4: Run it to confirm it fails.** Expected: FAIL.

- [ ] **Step 5: Implement saving.**

In `societiesAdmin.ts` `SocietyInput`, add:
```ts
  /** Omitted = leave as is. */
  kind?: 'society' | 'partner';
  audience?: string[] | null;
```
In `insertSociety`'s row, add `...(input.kind ? { kind: input.kind, audience: input.audience ?? null } : {}),`.

In `saveSociety.ts`:
```ts
import { encodePartnerMark } from '../../../utils/societies/encodePartnerMark';

export interface PartnerMarks { light: Blob | null; dark: Blob | null }

async function uploadMark(id: string, blob: Blob | null): Promise<string | null | undefined> {
  if (!blob) return undefined;                       // not changed
  return uploadSocietyLogo(id, await encodePartnerMark(blob)); // null = failed
}
```
Inside `saveSociety`, give it the extra parameter `marks: PartnerMarks = { light: null, dark: null }`. After the logo upload block:
```ts
  const lightPath = await uploadMark(input.id, marks.light);
  const darkPath = await uploadMark(input.id, marks.dark);
  if (lightPath === null || darkPath === null) return { error: 'upload_failed' };
  const partnerPatch = {
    ...(input.kind ? { kind: input.kind, audience: input.audience ?? null } : {}),
    ...(lightPath ? { mark_light_path: lightPath } : {}),
    ...(darkPath ? { mark_dark_path: darkPath } : {}),
  };
```
Spread `...partnerPatch` into the `updateSociety` patch object. For a new row, after a successful `insertSociety`, if `Object.keys(partnerPatch).length > 0`, call `updateSociety(input.id, partnerPatch)` and use its result as `saved`.

In `createSocietiesSlice.ts`, extend the `saveSociety` action's signature and its pass-through with the optional `marks` argument. Then update the action's type in `src/store/types.ts`.

Run `npx vitest run src/store/slices/societies`. Expected: PASS.

- [ ] **Step 6: Write the failing form test** `PartnerFields.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePartnerDraft } from '../PartnerFields';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

describe('usePartnerDraft', () => {
  it('starts from an existing partner', () => {
    const { result } = renderHook(() => usePartnerDraft(BUNDLED_SOCIETIES.ey));
    expect(result.current.kind).toBe('partner');
    expect(result.current.draft).toEqual({ pef: '' });
  });
  it('a society produces no audience', () => {
    const { result } = renderHook(() => usePartnerDraft(BUNDLED_SOCIETIES.esn));
    expect(result.current.toInput()).toEqual({ kind: 'society', audience: null });
    expect(result.current.validate()).toBeNull();
  });
  it('a partner needs a valid audience and a light mark', () => {
    const { result } = renderHook(() => usePartnerDraft(undefined));
    act(() => result.current.setKind('partner'));
    expect(result.current.validate()).toBe('errors.audience');
    act(() => result.current.setDraft({ pef: 'B-OI' }));
    expect(result.current.validate()).toBe('errors.mark_required');
    act(() => result.current.setLight(new File(['x'], 'm.png', { type: 'image/png' })));
    expect(result.current.validate()).toBeNull();
    expect(result.current.toInput()).toEqual({ kind: 'partner', audience: ['pef:B-OI'] });
  });
});
```

- [ ] **Step 7: Implement** `src/components/AdminConsole/PartnerFields.tsx`:
```tsx
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { ORGANIZERS, type FacultyKey, type Society } from '../../types/events';
import {
  audienceFromDraft,
  draftFromAudience,
  isPartner,
  type AudienceDraft,
} from '../../utils/partnerAudience';
import { LogoPreview } from './LogoPreview';
import type { PartnerMarks } from '../../store/slices/societies/saveSociety';

const FACULTIES = Object.keys(ORGANIZERS) as FacultyKey[];

/** Partner state for SocietyForm, kept out of it so the form stays under 200 lines. */
export function usePartnerDraft(society?: Society) {
  const [kind, setKind] = useState<'society' | 'partner'>(isPartner(society) ? 'partner' : 'society');
  const [draft, setDraft] = useState<AudienceDraft>(draftFromAudience(society?.audience));
  const [light, setLight] = useState<File | null>(null);
  const [dark, setDark] = useState<File | null>(null);

  const validate = (): string | null => {
    if (kind === 'society') return null;
    if (audienceFromDraft(draft) === 'invalid') return 'errors.audience';
    if (!light && !society?.markLight) return 'errors.mark_required';
    return null;
  };
  const toInput = () => {
    const audience = kind === 'partner' ? audienceFromDraft(draft) : null;
    return { kind, audience: audience === 'invalid' ? null : audience };
  };
  const marks: PartnerMarks = { light, dark };
  return { kind, setKind, draft, setDraft, light, setLight, dark, setDark, validate, toInput, marks };
}

type PartnerDraftState = ReturnType<typeof usePartnerDraft>;

/** Type switch, audience chips with optional programme codes, and two mark uploads. */
export function PartnerFields({ state }: { state: PartnerDraftState }) {
  const { t, language } = useTranslation();
  const { kind, setKind, draft, setDraft, light, setLight, dark, setDark } = state;
  const facultyName = (k: FacultyKey) =>
    k === 'mendelu' ? t('admin.societies.wholeMendelu') : ORGANIZERS[k][language === 'en' ? 'en' : 'cz'];
  const toggle = (k: FacultyKey) =>
    setDraft((d) => {
      const next = { ...d };
      if (k in next) delete next[k];
      else next[k] = '';
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t('admin.societies.kind')} className="join">
        {(['society', 'partner'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={`btn btn-sm join-item ${kind === k ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setKind(k)}
          >
            {t(k === 'society' ? 'admin.societies.kindSociety' : 'admin.societies.kindPartner')}
          </button>
        ))}
      </div>
      {kind === 'partner' && (
        <>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="opacity-70">{t('admin.societies.audience')}</legend>
            {FACULTIES.map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={k in draft} onChange={() => toggle(k)} />
                  {facultyName(k)}
                </label>
                {k in draft && k !== 'mendelu' && (
                  <input
                    className="input input-bordered input-sm ml-6"
                    placeholder={t('admin.societies.programmesPlaceholder')}
                    value={draft[k] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <span className="text-xs text-base-content/70">{t('admin.societies.audienceHint')}</span>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">{t('admin.societies.markLight')}</span>
            <input type="file" accept="image/png,image/webp" className="file-input file-input-bordered file-input-sm w-full"
              onChange={(e) => setLight(e.target.files?.[0] ?? null)} />
          </label>
          {light && <LogoPreview file={light} />}
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">{t('admin.societies.markDark')}</span>
            <input type="file" accept="image/png,image/webp" className="file-input file-input-bordered file-input-sm w-full"
              onChange={(e) => setDark(e.target.files?.[0] ?? null)} />
          </label>
          {dark && (
            <div data-theme="mendelu-dark" className="rounded-lg bg-base-100 p-2">
              <LogoPreview file={dark} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```
Before using `LogoPreview` for wide marks, check its markup. If it crops to a circle, render a plain object-URL `<img className="h-10 w-auto">` here instead.

- [ ] **Step 8: Mount it in `SocietyForm.tsx`.**
- Add `const partner = usePartnerDraft(society);` near the other state.
- In `submit`, after `validateSocietyDraft`:
  ```ts
  const partnerInvalid = partner.validate();
  if (partnerInvalid) return setError(partnerInvalid);
  ```
- In `persist`, spread `...partner.toInput()` into the `saveSociety` input object, and pass `partner.marks` as the 5th argument.
- Render `<PartnerFields state={partner} />` just before the logo label.

- [ ] **Step 9: Add the i18n keys** under `admin.societies`:

| key | cs | en |
|---|---|---|
| `kind` | Typ | Type |
| `kindSociety` | Spolek | Society |
| `kindPartner` | Partner | Partner |
| `audience` | Komu se partner ukáže | Who sees this partner |
| `audienceHint` | Fakulta bez kódů = celá fakulta. Kódy programů odděl čárkou, např. B-OI, N-OI. | A faculty with no codes = the whole faculty. Separate programme codes with commas, e.g. B-OI, N-OI. |
| `programmesPlaceholder` | Kódy programů (nepovinné) | Programme codes (optional) |
| `markLight` | Logo partnera – světlý režim (průhledné PNG) | Partner logo – light mode (transparent PNG) |
| `markDark` | Logo partnera – tmavý režim (nepovinné) | Partner logo – dark mode (optional) |
| `errors.audience` | Vyber aspoň jednu fakultu a zkontroluj kódy programů. | Pick at least one faculty and check the programme codes. |
| `errors.mark_required` | Partner potřebuje logo pro světlý režim. | A partner needs a light-mode logo. |

- [ ] **Step 10: Run the tests, the line-count check and the typecheck.**
Run: `npx vitest run src/components/AdminConsole src/store/slices/societies src/utils/societies && npm run typecheck && wc -l src/components/AdminConsole/SocietyForm.tsx src/components/AdminConsole/PartnerFields.tsx`
Expected: PASS, no type errors, both files ≤ ~200 lines.

- [ ] **Step 11: Commit.**
```bash
git add src/utils/societies/encodePartnerMark.ts src/utils/societies/__tests__ src/components/AdminConsole src/api/societiesAdmin.ts src/store src/i18n/locales
git commit -m "feat(admin): edit partner type, audience and colour marks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The per-programme breakdown in the stats panel

**Files:**
- Create: `src/api/usageProgrammes.ts`, `src/api/__tests__/usageProgrammes.test.ts`
- Modify: `src/store/slices/createAdminStatsSlice.ts`, its type in `src/store/types.ts`, `src/components/AdminConsole/AdminStatsPanel.tsx`, `scripts/appHealth.ts` (`READ_ONLY_SUPABASE_RPCS`), the locales

**Interfaces:**
- **Consumes:** the RPC `usage_programmes(p_days)` (Task 1); `UsageGroup` from `src/api/usageStats.ts`.
- **Produces:** `fetchUsageProgrammes(days: number): Promise<UsageGroup[] | null>`, and the store field `adminProgrammes: UsageGroup[] | null`.

- [ ] **Step 1: Write the failing test.** Mirror `src/api/__tests__/usageRetention.test.ts`'s mock of `adminAuthClient`:
```ts
it('parses the programme groups and keeps -1', async () => {
  rpc.mockResolvedValue({ data: [{ key: 'PEF B-OI', devices: 312 }, { key: 'PEF ?', devices: -1 }], error: null });
  expect(await fetchUsageProgrammes(7)).toEqual([{ key: 'PEF B-OI', devices: 312 }, { key: 'PEF ?', devices: -1 }]);
  expect(rpc).toHaveBeenCalledWith('usage_programmes', { p_days: 7 });
});
it('returns null on an error or a malformed payload', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
  expect(await fetchUsageProgrammes(7)).toBeNull();
  rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
  expect(await fetchUsageProgrammes(7)).toBeNull();
});
```

- [ ] **Step 2: Implement** `src/api/usageProgrammes.ts`:
```ts
import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';
import type { UsageGroup } from './usageStats';

const Schema = z.array(z.object({ key: z.string(), devices: z.number() }));

/**
 * Admin-only: DEVICES per faculty+programme ("PEF B-OI"; "PEF ?" = programme
 * not sent or not parsed). -1 = under 5, passed through as-is.
 */
export async function fetchUsageProgrammes(days: number): Promise<UsageGroup[] | null> {
  if (DEV_SOCIETY) return null;
  const { data, error } = await adminAuthClient.rpc('usage_programmes', { p_days: days });
  if (error) {
    logError('Api.fetchUsageProgrammes', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchUsageProgrammes', new Error('malformed usage_programmes'));
    return null;
  }
  return parsed.data;
}
```
Run the test. Expected: PASS.

- [ ] **Step 3: Wire it into the slice.** Mirror `loadRetention`:
```ts
/** Same contract as `loadRetention`: independent, and a failure keeps what is shown. */
async function loadProgrammes(set: Set): Promise<void> {
  const groups = await fetchUsageProgrammes(WINDOW_DAYS);
  if (groups) set({ adminProgrammes: groups });
}
```
Add `adminProgrammes: null,` and call `void loadProgrammes(set);` in `loadAdminStats`. Add `adminProgrammes: UsageGroup[] | null;` to the slice type. Extend `createAdminStatsSlice.test.ts` with a test that `loadAdminStats` sets `adminProgrammes`, mocking `../../../api/usageProgrammes` the way that file mocks `usageRetention`.

- [ ] **Step 4: Add the panel section.** In `AdminStatsPanel.tsx`, read `const programmes = useAppStore((s) => s.adminProgrammes);`. Add after the platform/faculty grid:
```tsx
      {programmes && programmes.length > 0 && (
        <section>
          <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byProgramme')}</h4>
          <StatsBars
            groups={programmes}
            labelFor={(k) => (k.endsWith(' ?') ? t('admin.stats.programmeUnknown', { faculty: k.slice(0, -2) }) : k)}
            under5={t('admin.stats.under5')}
          />
        </section>
      )}
```
i18n under `admin.stats`:
- cs: `"byProgramme": "Podle programu"`, `"programmeUnknown": "{{faculty}} – program neznámý"`
- en: `"byProgramme": "By programme"`, `"programmeUnknown": "{{faculty}} – programme unknown"`

Check the interpolation syntax used by other keys in the file (`{{x}}` or `{x}`) and match it.

In `scripts/appHealth.ts`, add `'usage_programmes' /* read-only aggregate, no writes */,` to `READ_ONLY_SUPABASE_RPCS`.

- [ ] **Step 5: Run the tests and the typecheck.**
Run: `npx vitest run src/api/__tests__/usageProgrammes src/store/slices/__tests__/createAdminStatsSlice src/components/AdminConsole scripts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add src/api/usageProgrammes.ts src/api/__tests__/usageProgrammes.test.ts src/store src/components/AdminConsole/AdminStatsPanel.tsx scripts/appHealth.ts src/i18n/locales
git commit -m "feat(admin): weekly devices per study programme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The partners block on both trees

**Files:**
- Create: `src/hooks/useMatchingPartners.ts`, `src/components/brand/PartnerMark.tsx`, `src/components/Partners/PartnersBlock.tsx`, `src/components/Partners/__tests__/PartnersBlock.test.tsx`, `src/test/guards/partnersBlockOnBothTrees.test.ts`
- Modify: `src/components/mobile/screens/profile/AboutSection.tsx`, `src/components/mobile/screens/profile/__tests__/AboutSection.test.tsx`, `src/components/Sidebar/ProfilePopup.tsx`, the locales (remove `about.eyBody`)

**Interfaces:**
- **Consumes:** `matchingPartners` (Task 2), `useViewer` (Task 4), `useTheme().isDark`, `EyMark`.
- **Produces:**
  - `useMatchingPartners(): Society[]`
  - `PartnerMark({ partner, className }: { partner: Society; className?: string })`
  - `PartnersBlock({ className, compact }: { className?: string; compact?: boolean })`, which renders `null` when there is no match.

- [ ] **Step 1: Write the failing tests.** `PartnersBlock.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { PartnersBlock } from '../PartnersBlock';

const kpmg = {
  ...BUNDLED_SOCIETIES.ey!, id: 'kpmg', name: 'KPMG', audience: ['frrms'],
  markLight: 'https://x/light.png', markDark: 'https://x/dark.png',
};

describe('PartnersBlock', () => {
  beforeEach(() =>
    useAppStore.setState({
      societies: { ...BUNDLED_SOCIETIES, kpmg }, userFaculty: 'PEF', userProgramme: 'B-OI',
      isErasmus: false, impersonation: null, theme: 'mendelu',
    })
  );
  it('shows only the partners of the student field', () => {
    render(<PartnersBlock />);
    expect(screen.getByRole('img', { name: 'EY' })).toBeTruthy();
    expect(screen.queryByAltText('KPMG')).toBeNull();
  });
  it('renders nothing when no partner matches', () => {
    useAppStore.setState({ userFaculty: 'ZF', userProgramme: null });
    const { container } = render(<PartnersBlock />);
    expect(container.firstChild).toBeNull();
  });
  it('uses the dark mark in dark mode', () => {
    useAppStore.setState({ userFaculty: 'FRRMS', theme: 'mendelu-dark' });
    render(<PartnersBlock />);
    expect(screen.getByAltText('KPMG').getAttribute('src')).toBe('https://x/dark.png');
  });
});
```
Check the store's theme field name and values in `useTheme.ts` (`theme === 'mendelu'` / `'mendelu-dark'`). If the impersonation field is named differently, adjust the `setState`.

`src/test/guards/partnersBlockOnBothTrees.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Partners are paid to appear to their field on EVERY product (spec
 * 2026-10-09): the phone tree's Profile and the extension's settings popup.
 * Dropping either mount silently breaks a promise made to a paying partner.
 */
const MOUNTS = [
  'src/components/mobile/screens/profile/AboutSection.tsx',
  'src/components/Sidebar/ProfilePopup.tsx',
];

describe('the partners block is on both trees', () => {
  it.each(MOUNTS)('%s renders PartnersBlock', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/<PartnersBlock\b/);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail.**
Run: `npx vitest run src/components/Partners src/test/guards/partnersBlockOnBothTrees.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/hooks/useMatchingPartners.ts`:
```ts
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { matchingPartners } from '../utils/partnerAudience';
import { useViewer } from './useViewer';
import type { Society } from '../types/events';

/** The partners this student's field has, decided on the device (spec 2026-10-09). */
export function useMatchingPartners(): Society[] {
  const societies = useAppStore((s) => s.societies);
  const viewer = useViewer();
  return useMemo(() => matchingPartners(societies, viewer), [societies, viewer]);
}
```
`src/components/brand/PartnerMark.tsx`:
```tsx
import type { Society } from '../../types/events';
import { useTheme } from '../../hooks/useTheme';
import { EyMark } from './EyMark';

/**
 * A partner's colour mark, as uploaded: no plate, no card, no link (see
 * AboutSection). Dark mode takes the dark mark when there is one. EY keeps its
 * inline mark until its uploads exist, so the first partner never goes blank.
 */
export function PartnerMark({ partner, className = 'h-7' }: { partner: Society; className?: string }) {
  const { isDark } = useTheme();
  const src = (isDark && partner.markDark) || partner.markLight;
  if (src) return <img src={src} alt={partner.name} className={`w-auto ${className}`} />;
  if (partner.id === 'ey') return <EyMark className={`${className} text-base-content`} />;
  return <span className="text-sm font-semibold text-base-content">{partner.name}</span>;
}
```
`src/components/Partners/PartnersBlock.tsx`:
```tsx
import { useTranslation } from '../../hooks/useTranslation';
import { useMatchingPartners } from '../../hooks/useMatchingPartners';
import { PartnerMark } from '../brand/PartnerMark';

/**
 * "Spolupracujeme s firmami" on both trees: the shared rule text, then the
 * marks of the partners of THIS student's field. No partner, no block — an
 * empty slot would read as an ad space.
 */
export function PartnersBlock({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const partners = useMatchingPartners();
  if (partners.length === 0) return null;
  return (
    <div className={`flex flex-col items-center gap-1 text-center ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
        {t('about.partnersLabel')}
      </span>
      <p className={`max-w-[21rem] leading-snug text-base-content/60 md:max-w-[34rem] ${compact ? 'text-xs' : 'text-sm'}`}>
        {t('about.partnersBody')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {partners.map((p) => (
          <PartnerMark key={p.id} partner={p} className={compact ? 'h-5' : 'h-7'} />
        ))}
      </div>
    </div>
  );
}
```
In `AboutSection.tsx`:
- Keep the long doc comment and the short-screen comment.
- Change the function body to:
  ```tsx
  return <PartnersBlock className="[@media(max-height:779px)]:hidden px-4 pb-1 pt-2" />;
  ```
- Remove the `EyMark` and `useTranslation` imports.

In `ProfilePopup.tsx`, inside the Support section, before the report button:
```tsx
          {/* Same block as the phone's Profil (spec 2026-10-09): partners reach
              their field on every product, the extension included. */}
          <PartnersBlock compact className="border-b border-base-200 px-1 pb-2 pt-1" />
```
Remove `about.eyBody` from both locales: first run `grep -rn "eyBody" src` and confirm no other use remains. Update `AboutSection.test.tsx` to set the store the same way as the block test, and assert the EY mark for a PEF student.

- [ ] **Step 4: Run the tests and the typecheck.**
Run: `npx vitest run src/components/Partners src/components/mobile/screens/profile src/components/Sidebar src/test/guards && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Verify the UI.** Use the verify-ui skill:
- the phone tree at 320, 390 and 430 px and at tablet width (834 px), in both themes;
- the extension's `ProfilePopup` at desktop width.

Use dev:web data where the student's faculty is PEF, then switch `userFaculty` to `ZF` in the store to confirm the block disappears. Save before/after PNGs and send them to Dominik (memory: verifying-ui-work).

- [ ] **Step 6: Commit.**
```bash
git add src/hooks/useMatchingPartners.ts src/components/brand/PartnerMark.tsx src/components/Partners src/components/mobile/screens/profile src/components/Sidebar/ProfilePopup.tsx src/test/guards/partnersBlockOnBothTrees.test.ts src/i18n/locales
git commit -m "feat(partners): field-targeted partners block on phone and extension

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Privacy disclosures and docs

**Files:**
- Modify: `privacy/disclosures.ts` (the `daily_count` flow), `PRIVACY.md`, `docs/privacy-policy-app.md`, `CLAUDE.md` ("What reIS still sends", item 1), and the generated policy table (`npm run privacy:generate`)

- [ ] **Step 1: Update the `daily_count` flow.**
```ts
    what: 'One row per install per day: random install id, faculty, base study-programme code and platform labels.',
```
Its policy row text becomes:
```ts
        'a random install identifier — a UUID unrelated to you. Counts **installs, not people**, plus faculty, study programme (e.g. B-OI) and platform as group labels.',
```

- [ ] **Step 2: Update the other docs.**
- In `PRIVACY.md` and `docs/privacy-policy-app.md`, find the daily-count sentences with `grep -n "faculty" PRIVACY.md docs/privacy-policy-app.md`. Add the programme to each one, in the same words as Step 1.
- Add this sentence where the policy explains partners: "Which partner you are shown is decided on your device from your faculty and programme; partners never receive anything about you."
- In `CLAUDE.md` item 1 of "What reIS still sends", replace "never anything derived from the student" with: "plus faculty, base programme code and platform as aggregate labels; nothing else derived from the student."

- [ ] **Step 3: Regenerate the policy table and run the guards.**
Run: `npm run privacy:generate && npx vitest run scripts/lib/__tests__/privacyDisclosures src/test/guards/noStudentDataLeaves`
Then (memory: policy-guard-tests-after-doc-edits): `grep -rln "privacy-policy-app\|PRIVACY.md" src scripts | grep test`, and run each file it lists.
Expected: all PASS. If a line-sensitive guard fails because a sentence was reflowed, restore the original line breaks.

- [ ] **Step 4: Commit.**
```bash
git add privacy PRIVACY.md docs/privacy-policy-app.md CLAUDE.md
git commit -m "docs(privacy): daily count carries the base programme; partner matching is on-device

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Final checks and the parked PR

- [ ] **Step 1: Run every test touched by this branch, plus the typecheck.**
Run: `npx vitest run partnerAudience eventAudience societies createContextSlice feedback ComposerAudienceField PartnerFields saveSociety encodePartnerMark usageProgrammes createAdminStatsSlice PartnersBlock AboutSection partnersBlockOnBothTrees privacyDisclosures noStudentDataLeaves && npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Push and open the PR against `test`** (memory: github-push-identity, for the push remote and the author).
```bash
git push -u personal feat/partner-field-targeting
gh pr create --base test --title "feat(partners): field-targeted partners, editable in the console" --body "<summary + 'Parked: do not merge; migration applied by hand after approval' + 🤖 Generated with [Claude Code](https://claude.com/claude-code)>"
```
Then turn on Auto-fix (memory: always-enable-auto-fix), and bind the PR with the ccd_pr tools.

- [ ] **Step 3: Outside the repo (no commit).**
- Republish the pitch-deck artifact with the privacy slide reworded to "k nám jdou jen souhrnné štítky fakulty a oboru".
- Make the same edit in `partner-pitch-brief.md`.
- Update the memory `partner-field-targeting-build.md`: built, in PR #N, migration not yet applied.

- [ ] **Step 4: Rollout. This needs Dominik's go-ahead and is not part of the PR.**
1. Check every released tag's readers and writers of `societies` and `track_daily_usage` (memory: db-changes-must-not-break-deployed-builds).
2. Dry-run the migration against prod in a self-unwinding DO block, then apply it with `npx supabase db query --linked -f supabase/migrations/20261011120000_partner_targeting.sql`.
3. Upload the EY light and dark marks in the console.
4. Enter the KPMG, SAP or Red Hat, ADMD and De Heus audiences once each is signed. The LDF codes are read from IS first.
