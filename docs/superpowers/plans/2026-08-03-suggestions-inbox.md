# Suggestions Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move student feedback off the client-side Discord webhook into a Supabase `suggestions` table, read and triaged inside reIS by the shared `reis_admin` login.

**Architecture:** Students submit through a secret-gated Edge Function that validates, rate-limits on a salted IP hash, and inserts with the service role — the client never touches the table. Admins read and update `status` directly via `adminAuthClient`, whose authenticated session satisfies an RLS policy of `get_my_role() = 'reis_admin'`. The inbox replaces the dead-end note in `SocietyAdminOverlay`; an unread count fires a toast at boot.

**Tech Stack:** Supabase (Postgres + RLS + Deno Edge Functions), WXT, React 19, Zustand slices, DaisyUI, sonner, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-03-suggestions-inbox-design.md`

## Global Constraints

- **NO `localStorage`/`sessionStorage`** — use `IndexedDBService` (Iron Rule).
- **NO proxy/re-export files** — import directly from implementation files.
- **NO `useEffect` for data fetching** — fetch in services/store, never in components.
- **NO custom CSS** — DaisyUI semantic classes only (`btn-primary`, `bg-base-200`).
- **All state in Zustand slices.**
- **Max 200 lines per file** — split proactively.
- **Test first** — the failing test is written and *run* before implementation.
- `screen` values are exactly the `AppView` union from `src/types/app.ts`: `calendar | exams | settings | timeline-demo | subjects | studyPlan | erasmus | iskam-dashboard | map`. Nothing else is ever sent or accepted.
- **`window.location.href` must never appear in a suggestion payload.** It carries `studium=`/`obdobi=`/`predmet=`/`termin=` on IS pages.
- `contact` is PII: readable only under the `reis_admin` policy, never logged, never in telemetry.
- Before any push, run the changed-files lint gate: `npx eslint <changed files> --max-warnings=0`. `npm run lint` has pre-existing noise that hides new errors.
- Naming: **`suggestions`**. `feedback_responses`/`createFeedbackSlice` is the NPS pipeline and `notifications`/`createNotificationSlice` is the student-facing society feed — both names are taken and mean something else.

**Prerequisite outside this plan (human, do first):** delete the feedback webhook in Discord. Between that and Task 5, `FeedbackModal` posts to a dead URL and shows its error toast — expected, not a bug to debug.

---

### Task 1: Worktree deps and a `reis_admin` dev seed

The dev webapp currently seeds a fake **`association`** session and skips `loadAdminSession()` entirely, so the reis_admin path is unreachable at `localhost:3000` and nothing built later in this plan can be seen. Fix that first.

**Files:**
- Modify: `src/utils/mock/devSociety.ts`
- Create: `src/utils/mock/devSuggestions.ts`
- Modify: `src/store/useAppStore.ts:115-128`
- Test: `src/utils/mock/__tests__/devSociety.test.ts`

**Interfaces:**
- Consumes: `DEV_SOCIETY` from `src/utils/mock/devSociety.ts` (existing).
- Produces: `devAdminSeed(): DevAdminSeed | null` and `devSuggestionsStore` — Task 6 routes admin reads through the latter in dev.

- [ ] **Step 1: Install dependencies and confirm the baseline**

```bash
npm install
npx vitest run src/components/SocietyAdmin src/services/admin
```

Expected: 4 files pass. Before `npm install` the two `SocietyAdmin` files fail to *collect* with `Failed to resolve import "@capacitor/core"` — that is stale `node_modules`, not a code fault.

- [ ] **Step 2: Write the failing test**

Create `src/utils/mock/__tests__/devSociety.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { devAdminSeed } from '../devSociety';

describe('devAdminSeed', () => {
  it('returns null when no dev society is configured', () => {
    expect(devAdminSeed(false, undefined)).toBeNull();
  });

  it('seeds an association session by default', () => {
    expect(devAdminSeed('esn', undefined)).toEqual({
      adminRole: 'association',
      adminAssociationId: 'esn',
      email: 'esn@dev.local',
    });
  });

  it('seeds a reis_admin session with no association when asked', () => {
    expect(devAdminSeed('esn', 'reis_admin')).toEqual({
      adminRole: 'reis_admin',
      adminAssociationId: null,
      email: 'reis.mendelu@gmail.com',
    });
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/utils/mock/__tests__/devSociety.test.ts`
Expected: FAIL — `devAdminSeed is not a function`.

- [ ] **Step 4: Implement `devAdminSeed`**

Append to `src/utils/mock/devSociety.ts`:

```ts
export interface DevAdminSeed {
  adminRole: 'association' | 'reis_admin';
  adminAssociationId: string | null;
  email: string;
}

// Dev-only seed for the standalone webapp. VITE_DEV_ADMIN_ROLE=reis_admin makes
// localhost:3000 the reIS-admin surface (suggestions inbox); anything else keeps
// the existing association/organizer behaviour. Pure so it can be tested without
// touching import.meta.env.
export function devAdminSeed(
  society: string | false = DEV_SOCIETY,
  role: string | undefined = import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_ADMIN_ROLE as string | undefined)
    : undefined
): DevAdminSeed | null {
  if (!society) return null;
  if (role === 'reis_admin') {
    return {
      adminRole: 'reis_admin',
      adminAssociationId: null,
      email: 'reis.mendelu@gmail.com',
    };
  }
  return {
    adminRole: 'association',
    adminAssociationId: society,
    email: `${society}@dev.local`,
  };
}
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `npx vitest run src/utils/mock/__tests__/devSociety.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Use the seed at boot**

In `src/store/useAppStore.ts`, replace the `if (DEV_SOCIETY) { ... } else { s.loadAdminSession(); }` block (lines 115-128) with:

```ts
  const devSeed = devAdminSeed();
  if (devSeed) {
    // Dev-only: seed a persistent society/admin session so the organizer and
    // reIS-admin surfaces are available at localhost:3000 without a Supabase
    // login on every reload. Stripped from production by import.meta.env.DEV.
    useAppStore.setState({
      adminRole: devSeed.adminRole,
      adminAssociationId: devSeed.adminAssociationId,
      adminSession: { user: { email: devSeed.email } } as unknown as Session,
    });
    void s.loadSocietyPosts();
  } else {
    s.loadAdminSession();
  }
```

Update the import on line 40 from `import { DEV_SOCIETY } from '../utils/mock/devSociety';` to:

```ts
import { DEV_SOCIETY, devAdminSeed } from '../utils/mock/devSociety';
```

`DEV_SOCIETY` stays imported — `societyPosts` and other call sites still use it.

- [ ] **Step 7: Add the dev suggestions store**

Create `src/utils/mock/devSuggestions.ts`:

```ts
import type { SuggestionRow, SuggestionStatus } from '../../types/suggestions';

// In-memory stand-in for the Supabase `suggestions` table, mirroring
// devSocietyStore: a fake dev session cannot satisfy the RLS read policy, so
// admin reads route here when VITE_DEV_SOCIETY is set. Resets on reload.
let rows: SuggestionRow[] = [
  {
    id: 2,
    type: 'idea',
    title: 'Dark mode for the campus map',
    body: 'The map stays light while the rest of the app is dark.',
    contact: 'student@mendelu.cz',
    screen: 'map',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '1280x800',
    status: 'new',
    created_at: '2026-08-02T09:15:00.000Z',
  },
  {
    id: 1,
    type: 'bug',
    title: 'Exam list empty after enrolling',
    body: 'Enrolled for an exam, the panel stayed empty until I reloaded.',
    contact: null,
    screen: 'exams',
    ext_version: '4.0.0',
    browser_name: 'Firefox',
    browser_version: '142',
    viewport: '390x844',
    status: 'triaged',
    created_at: '2026-08-01T17:40:00.000Z',
  },
];

export const devSuggestionsStore = {
  list: (): SuggestionRow[] => [...rows],
  setStatus: (id: number, status: SuggestionStatus): void => {
    rows = rows.map((r) => (r.id === id ? { ...r, status } : r));
  },
};
```

- [ ] **Step 8: Verify the whole suite still passes, then lint and commit**

```bash
npx vitest run src/utils/mock src/store
npx eslint src/utils/mock/devSociety.ts src/utils/mock/devSuggestions.ts src/store/useAppStore.ts src/utils/mock/__tests__/devSociety.test.ts --max-warnings=0
git add src/utils/mock src/store/useAppStore.ts
git commit -m "feat(dev): seed a reis_admin session and mock suggestions for dev:web"
```

Note `devSuggestions.ts` imports types created in Task 4; if you are executing strictly in order, expect a TS error until Task 4 lands. Create `src/types/suggestions.ts` from Task 4 Step 4 now if you want a clean typecheck at this point.

---

### Task 2: Migration — table, policies, rate-limit RPC

**Files:**
- Create: `supabase/migrations/20260803120000_suggestions.sql`

**Interfaces:**
- Produces: table `public.suggestions`; RPC `public.check_and_log_suggestion(text, int) → boolean`, executable by `service_role` only. Task 3 calls the RPC; Task 6 selects and updates the table.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260803120000_suggestions.sql`:

```sql
-- Free-text student suggestions, replacing the client-side Discord webhook
-- (issue #163). Distinct from feedback_responses (per-semester NPS/subject
-- ratings) and from the student-facing society feed.

create table if not exists public.suggestions (
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

create index if not exists suggestions_status_time
  on public.suggestions (status, created_at desc);

-- Reads and status writes are for reIS admins only. get_my_role() resolves the
-- caller's role from spolky_accounts by JWT email where is_active — the same
-- gate already gating feedback_responses.
drop policy if exists "Admin read suggestions" on public.suggestions;
create policy "Admin read suggestions" on public.suggestions
  for select to authenticated
  using (public.get_my_role() = 'reis_admin');

drop policy if exists "Admin update suggestion status" on public.suggestions;
create policy "Admin update suggestion status" on public.suggestions
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

-- RLS cannot restrict WHICH COLUMNS an update touches, and Supabase grants
-- broadly on public by default. Revoke first, then grant select plus a
-- column-scoped update: without this an admin session could rewrite a
-- student's own text. Inserts and deletes belong to the service role alone.
revoke all on public.suggestions from anon, authenticated;
grant select on public.suggestions to authenticated;
grant update (status) on public.suggestions to authenticated;

-- Rate limiting -------------------------------------------------------------

create table if not exists public.suggestions_rate_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.suggestions_rate_log enable row level security;
-- Deny-all: only the SECURITY DEFINER function below touches it.

create index if not exists suggestions_rate_log_hash_time
  on public.suggestions_rate_log (ip_hash, created_at);

create or replace function public.check_and_log_suggestion(
  p_ip_hash text,
  p_max int default 5
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- Serialize concurrent submissions from the same source so check-then-insert
  -- cannot race (TOCTOU): two parallel requests could otherwise both read the
  -- old count and both insert, bypassing the cap. Released at commit.
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));

  -- Prune. This table must not become a growing record of who submitted from
  -- where; one hour of history is all the cap needs.
  delete from public.suggestions_rate_log
   where created_at < now() - interval '24 hours';

  select count(*) into recent
    from public.suggestions_rate_log
   where ip_hash = p_ip_hash
     and created_at > now() - interval '1 hour';

  if recent >= p_max then
    return false;
  end if;

  insert into public.suggestions_rate_log (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke all on function public.check_and_log_suggestion(text, int) from public;
grant execute on function public.check_and_log_suggestion(text, int) to service_role;
```

- [ ] **Step 2: Apply it**

Apply with the Supabase MCP `apply_migration` tool (project `zvbpgkmnrqyprtkyxkwn`, name `20260803120000_suggestions`), or `npx supabase db push` if the CLI is linked. Keep the file in `supabase/migrations/` either way.

- [ ] **Step 3: Verify the grants landed as intended**

Run via `execute_sql`:

```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'suggestions' and grantee in ('anon','authenticated')
union all
select grantee, privilege_type, null
from information_schema.table_privileges
where table_name = 'suggestions' and grantee in ('anon','authenticated')
order by 1,2;
```

Expected: `authenticated` has `SELECT` on the table and `UPDATE` on **`status` only**. `anon` appears nowhere. If `anon` has anything, the `revoke` did not take — stop and fix before continuing.

- [ ] **Step 4: Verify RLS denies the anon client**

```sql
set local role anon;
select count(*) from public.suggestions;
reset role;
```

Expected: permission denied (the grant was revoked). This is the security boundary; no vitest run covers it.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260803120000_suggestions.sql
git commit -m "feat(db): suggestions table, admin-only policies, rate-limit RPC"
```

---

### Task 3: `submit-suggestion` Edge Function

**Files:**
- Create: `supabase/functions/submit-suggestion/index.ts`

**Interfaces:**
- Consumes: `check_and_log_suggestion` from Task 2.
- Produces: `POST /functions/v1/submit-suggestion` accepting `{type, title, body, contact?, screen, ext_version, browser_name, browser_version, viewport}` and returning `{ok:true}` / `{error}` with 400, 401, 429, 500, 503. Task 4 consumes these exact status codes.

- [ ] **Step 1: Write the function**

Create `supabase/functions/submit-suggestion/index.ts`:

```ts
// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// @ts-ignore
const EXTENSION_SECRET = Deno.env.get('EXTENSION_SECRET');
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// No default: an unsalted IP hash is reversible and the IP is personal data.
// Absent → fail closed (checked in the handler), never a known fallback.
// @ts-ignore
const HASH_SALT = Deno.env.get('SUGGESTION_HASH_SALT');

const RATE_LIMIT_PER_HOUR = 5;

const TYPES = new Set(['bug', 'idea', 'other']);

// Exactly the AppView union in src/types/app.ts. An unknown screen is a client
// bug or a forged payload; both are 400 rather than something we store.
const SCREENS = new Set([
  'calendar',
  'exams',
  'settings',
  'timeline-demo',
  'subjects',
  'studyPlan',
  'erasmus',
  'iskam-dashboard',
  'map',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-reis-extension-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

async function fetchWithTimeout(url: string, opts: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Atomic check-and-log via the RPC. Fails closed (treated as over-limit) if the
// rate-limit backend is misconfigured or unreachable.
async function underRateLimit(ipHash: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return false;
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/check_and_log_suggestion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ p_ip_hash: ipHash, p_max: RATE_LIMIT_PER_HOUR }),
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

interface Body {
  type?: string;
  title?: string;
  body?: string;
  contact?: string;
  screen?: string;
  ext_version?: string;
  browser_name?: string;
  browser_version?: string;
  viewport?: string;
}

function clamp(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Fail closed: a missing server secret (auth) or hash salt (privacy) must
    // reject rather than degrade to a public/known value.
    if (!EXTENSION_SECRET || !HASH_SALT || !SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: 'unavailable' }, 503);
    }
    if (req.headers.get('x-reis-extension-secret') !== EXTENSION_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const raw = (await req.json().catch(() => ({}))) as Body;
    const type = clamp(raw.type, 16);
    const title = clamp(raw.title, 120);
    const body = clamp(raw.body, 2000);
    const screen = clamp(raw.screen, 40);
    const contact = clamp(raw.contact, 120);

    if (!TYPES.has(type) || !title || !body || !SCREENS.has(screen)) {
      return json({ error: 'invalid' }, 400);
    }

    // Rate limit per source IP, hashed and salted — never stored raw.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';
    const ipHash = await sha256(`${HASH_SALT}:${ip}`);
    if (!(await underRateLimit(ipHash))) return json({ error: 'rate_limited' }, 429);

    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/suggestions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        type,
        title,
        body,
        contact: contact || null,
        screen,
        ext_version: clamp(raw.ext_version, 20),
        browser_name: clamp(raw.browser_name, 20),
        browser_version: clamp(raw.browser_version, 10),
        viewport: clamp(raw.viewport, 20),
      }),
    });

    if (!res.ok) return json({ error: 'upstream' }, 500);
    return json({ ok: true });
  } catch {
    return json({ error: 'upstream' }, 500);
  }
});
```

- [ ] **Step 2: Set the secret and deploy**

`EXTENSION_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already exist in the project. Add the new one, then deploy with `verify_jwt` disabled (the publishable key cannot be sent as a bearer token):

```bash
npx supabase secrets set SUGGESTION_HASH_SALT="$(openssl rand -hex 32)"
npx supabase functions deploy submit-suggestion --no-verify-jwt
```

- [ ] **Step 3: Verify a valid submission is accepted**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://zvbpgkmnrqyprtkyxkwn.supabase.co/functions/v1/submit-suggestion" -H 'content-type: application/json' -H 'x-reis-extension-secret: reis-secret' -d '{"type":"bug","title":"curl smoke test","body":"delete me","screen":"exams","ext_version":"4.0.0","browser_name":"Chrome","browser_version":"131","viewport":"1280x800"}'
```

Expected: `200`. Substitute the real `EXTENSION_SECRET` if it is not the `reis-secret` dev default.

- [ ] **Step 4: Verify an unknown screen is rejected**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://zvbpgkmnrqyprtkyxkwn.supabase.co/functions/v1/submit-suggestion" -H 'content-type: application/json' -H 'x-reis-extension-secret: reis-secret' -d '{"type":"bug","title":"x","body":"y","screen":"https://is.mendelu.cz/auth/student/?studium=123"}'
```

Expected: `400`. This is the regression guard for the IS-URL leak — a URL is not a screen.

- [ ] **Step 5: Verify the rate limit trips**

```bash
for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " -X POST "https://zvbpgkmnrqyprtkyxkwn.supabase.co/functions/v1/submit-suggestion" -H 'content-type: application/json' -H 'x-reis-extension-secret: reis-secret' -d '{"type":"other","title":"rate test","body":"delete me","screen":"calendar"}'; done; echo
```

Expected: `200 200 200 200 200 429 429` — five through, the rest capped.

- [ ] **Step 6: Clean up the smoke-test rows**

```sql
delete from public.suggestions where body = 'delete me';
delete from public.suggestions_rate_log;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/submit-suggestion/index.ts
git commit -m "feat(edge): submit-suggestion function with screen allowlist and IP rate limit"
```

---

### Task 4: Client submit API

**Files:**
- Create: `src/types/suggestions.ts`
- Create: `src/api/suggestions.ts`
- Test: `src/api/__tests__/suggestions.test.ts`

**Interfaces:**
- Consumes: the Edge Function contract from Task 3.
- Produces:
  - `type SuggestionType = 'bug' | 'idea' | 'other'`
  - `type SuggestionStatus = 'new' | 'triaged' | 'done'`
  - `interface SuggestionRow` (fields exactly as the table columns)
  - `interface SuggestionDraft { type; title; body; contact?: string }`
  - `type SubmitResult = { ok: true } | { ok: false; error: 'rate_limited' | 'invalid' | 'upstream' | 'offline' }`
  - `buildSuggestionPayload(draft: SuggestionDraft, screen: AppView): SuggestionPayload`
  - `resolveScreen(raw: unknown): AppView`
  - `submitSuggestion(draft: SuggestionDraft): Promise<SubmitResult>`

  Task 5 calls `submitSuggestion`; Task 6 imports `SuggestionRow`/`SuggestionStatus`.

- [ ] **Step 1: Write the failing test**

Create `src/api/__tests__/suggestions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSuggestionPayload, resolveScreen, submitSuggestion } from '../suggestions';

describe('buildSuggestionPayload', () => {
  it('sends the reIS screen and never the host URL', () => {
    const p = buildSuggestionPayload(
      { type: 'bug', title: 'T', body: 'B' },
      'exams'
    );
    expect(p.screen).toBe('exams');
    expect(JSON.stringify(p)).not.toContain('mendelu.cz');
    expect(JSON.stringify(p)).not.toContain('http');
  });

  it('carries the optional contact through', () => {
    const p = buildSuggestionPayload(
      { type: 'idea', title: 'T', body: 'B', contact: 'a@b.cz' },
      'map'
    );
    expect(p.contact).toBe('a@b.cz');
  });
});

describe('resolveScreen', () => {
  it('accepts a known AppView', () => {
    expect(resolveScreen('studyPlan')).toBe('studyPlan');
  });

  it('falls back to calendar for anything unknown', () => {
    expect(resolveScreen('https://is.mendelu.cz/auth/?studium=123')).toBe('calendar');
    expect(resolveScreen(undefined)).toBe('calendar');
    expect(resolveScreen(42)).toBe('calendar');
  });
});

describe('submitSuggestion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps 429 to rate_limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    );
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('maps 400 to invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    );
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'invalid' });
  });

  it('maps a network throw to offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'offline' });
  });

  it('returns ok on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    );
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/api/__tests__/suggestions.test.ts`
Expected: FAIL — cannot resolve `../suggestions`.

- [ ] **Step 3: Create the types**

Create `src/types/suggestions.ts`:

```ts
export type SuggestionType = 'bug' | 'idea' | 'other';
export type SuggestionStatus = 'new' | 'triaged' | 'done';

export interface SuggestionDraft {
  type: SuggestionType;
  title: string;
  body: string;
  contact?: string;
}

export interface SuggestionPayload extends SuggestionDraft {
  screen: string;
  ext_version: string;
  browser_name: string;
  browser_version: string;
  viewport: string;
}

export interface SuggestionRow {
  id: number;
  type: SuggestionType;
  title: string;
  body: string;
  contact: string | null;
  screen: string;
  ext_version: string;
  browser_name: string;
  browser_version: string;
  viewport: string;
  status: SuggestionStatus;
  created_at: string;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: 'rate_limited' | 'invalid' | 'upstream' | 'offline' };
```

- [ ] **Step 4: Implement the API**

Create `src/api/suggestions.ts`:

```ts
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { logError } from '@/utils/reportError';
import { getBrowserInfo } from '@/services/errorReporter/sanitize';
import { IndexedDBService } from '@/services/storage';
import type { AppView } from '@/types/app';
import type { SuggestionDraft, SuggestionPayload, SubmitResult } from '@/types/suggestions';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/submit-suggestion`;

// Exactly the AppView union. The host URL is deliberately NOT sent: on IS it
// carries studium=/obdobi=/predmet=/termin=, which sanitize.ts redacts wholesale
// for telemetry. The screen is the useful half with none of the risk.
const SCREENS: readonly AppView[] = [
  'calendar',
  'exams',
  'settings',
  'timeline-demo',
  'subjects',
  'studyPlan',
  'erasmus',
  'iskam-dashboard',
  'map',
];

export function resolveScreen(raw: unknown): AppView {
  return SCREENS.includes(raw as AppView) ? (raw as AppView) : 'calendar';
}

function extVersion(): string {
  try {
    return chrome?.runtime?.getManifest?.().version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function buildSuggestionPayload(
  draft: SuggestionDraft,
  screen: AppView
): SuggestionPayload {
  const browser = getBrowserInfo();
  return {
    ...draft,
    screen,
    ext_version: extVersion(),
    browser_name: browser.name,
    browser_version: browser.version,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

// The current screen is read from the key useAppLogic already persists on every
// view change. Reading it here keeps FeedbackModal working identically on
// desktop and in the mobile sheet stack, which has no route prop to drill.
async function currentScreen(): Promise<AppView> {
  try {
    return resolveScreen(await IndexedDBService.get('meta', 'reis_current_view'));
  } catch {
    return 'calendar';
  }
}

export async function submitSuggestion(draft: SuggestionDraft): Promise<SubmitResult> {
  try {
    const payload = buildSuggestionPayload(draft, await currentScreen());
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    if (res.status === 400) return { ok: false, error: 'invalid' };
    return { ok: false, error: 'upstream' };
  } catch (err) {
    logError('Api.submitSuggestion', err);
    return { ok: false, error: 'offline' };
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/api/__tests__/suggestions.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint src/api/suggestions.ts src/types/suggestions.ts src/api/__tests__/suggestions.test.ts --max-warnings=0
git add src/api/suggestions.ts src/types/suggestions.ts src/api/__tests__/suggestions.test.ts
git commit -m "feat(api): submitSuggestion sends the reIS screen, never the IS URL"
```

---

### Task 5: Swap FeedbackModal off Discord

This is the task that removes the leaked credential from the bundle.

**Files:**
- Modify: `src/components/Feedback/FeedbackModal.tsx:4,27-62`
- Delete: `src/constants/config.ts`
- Modify: `PRIVACY.md`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/components/Feedback/__tests__/FeedbackModal.test.tsx`

**Interfaces:**
- Consumes: `submitSuggestion` from Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/components/Feedback/__tests__/FeedbackModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

const submitSuggestion = vi.fn();
vi.mock('../../../api/suggestions', () => ({
  submitSuggestion: (...args: unknown[]) => submitSuggestion(...args),
}));

describe('FeedbackModal', () => {
  beforeEach(() => {
    submitSuggestion.mockReset();
    submitSuggestion.mockResolvedValue({ ok: true });
    useAppStore.setState({ language: 'en' });
  });

  it('submits the draft through submitSuggestion, not a webhook', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), {
      target: { value: 'Exams empty' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: 'Panel stayed empty' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));

    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion).toHaveBeenCalledWith({
      type: 'bug',
      title: 'Exams empty',
      body: 'Panel stayed empty',
      contact: '',
    });
  });

  it('shows the success state when the submission lands', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), {
      target: { value: 'T' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: 'B' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));
    expect(await screen.findByText('Sent!')).toBeInTheDocument();
  });

  it('stays on the form when the submission fails', async () => {
    submitSuggestion.mockResolvedValue({ ok: false, error: 'rate_limited' });
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), {
      target: { value: 'T' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: 'B' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalled());
    expect(screen.queryByText('Sent!')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/components/Feedback/__tests__/FeedbackModal.test.tsx`
Expected: FAIL — the modal still calls `fetch` against the webhook, so `submitSuggestion` is never called.

- [ ] **Step 3: Rewrite the submit path**

In `src/components/Feedback/FeedbackModal.tsx`, replace the import on line 4:

```tsx
import { submitSuggestion } from '../../api/suggestions';
```

and replace `handleSubmit` (lines 23-62) with:

```tsx
  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setIsSending(true);

    // Context (screen, version, browser, viewport) is assembled in the API
    // layer. Deliberately no window.location.href: on IS it carries
    // studium=/obdobi=/predmet=/termin=.
    // NOTE the rename: SuggestionDraft's field is `body`, the component's state
    // variable is `message`.
    const result = await submitSuggestion({ type, title, body: message, contact });

    if (result.ok) {
      setIsSuccess(true);
      toast.success(t('feedback.toastSuccess'));
    } else {
      toast.error(t('feedback.toastError'));
    }
    setIsSending(false);
  };
```

`logError` is no longer used in this file — remove the `import { logError } from '../../utils/reportError';` line on line 7. Errors are now logged inside `submitSuggestion`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/Feedback/__tests__/FeedbackModal.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Delete the webhook constant**

```bash
git rm src/constants/config.ts
grep -rn "DISCORD_WEBHOOK_URL\|constants/config" src/ || echo "clean"
```

Expected: `clean`. `DISCORD_WEBHOOK_URL` was the file's only export.

- [ ] **Step 6: Drop Discord from the user-facing copy**

In both `src/i18n/locales/cs.json` and `src/i18n/locales/en.json`, change `feedback.contactPlaceholder` from `"Email / Discord"` to `"Email"`. Discord is no longer a channel reIS uses.

- [ ] **Step 7: Update PRIVACY.md**

Two edits:
- Line ~45: replace the Discord-webhook storage sentence with: *"**Storage**: Suggestions are stored in reIS's own Supabase project and are readable only by the reIS maintainer account."*
- Line ~65: remove the **Discord** (`discord.com`) third-party entry. Nothing replaces it — Supabase is already listed.

Add a sentence documenting the new processing, since a hashed IP is personal data:

> To limit abuse of the suggestion form, a salted SHA-256 hash of the sending IP address is stored for at most 24 hours. The raw IP is never stored.

- [ ] **Step 8: Verify the whole feedback path and commit**

```bash
npx vitest run src/components/Feedback src/api
npx eslint src/components/Feedback/FeedbackModal.tsx src/components/Feedback/__tests__/FeedbackModal.test.tsx --max-warnings=0
git add -A src/components/Feedback src/constants src/i18n PRIVACY.md
git commit -m "feat(feedback): submit via Supabase, delete the Discord webhook constant

Closes the credential leak in #163 — the webhook URL no longer ships in the
bundle. Deleting it here revokes nothing (it is in git history on a public
repo); the Discord-side delete is the revocation."
```

---

### Task 6: Admin read API and suggestions slice

**Files:**
- Create: `src/api/suggestionsAdmin.ts`
- Create: `src/store/slices/createSuggestionsSlice.ts`
- Modify: `src/store/types.ts:605`
- Modify: `src/store/useAppStore.ts` (slice registration)
- Test: `src/store/slices/__tests__/createSuggestionsSlice.test.ts`

**Interfaces:**
- Consumes: `SuggestionRow`, `SuggestionStatus` (Task 4); `devSuggestionsStore` (Task 1); `adminAuthClient` from `src/services/admin/authClient.ts`.
- Produces:
  - `listSuggestions(): Promise<SuggestionRow[]>` and `setSuggestionStatus(id: number, status: SuggestionStatus): Promise<boolean>` in `src/api/suggestionsAdmin.ts`
  - `interface SuggestionsSlice { suggestions: SuggestionRow[]; suggestionsUnread: number; loadSuggestions(): Promise<void>; updateSuggestionStatus(id: number, status: SuggestionStatus): Promise<void> }`

  The slice action is `updateSuggestionStatus`, deliberately **not** the same name as the API's `setSuggestionStatus`. Tasks 7 and 8 use the slice name.

- [ ] **Step 1: Write the admin API**

Create `src/api/suggestionsAdmin.ts`:

```ts
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';
import { devSuggestionsStore } from '@/utils/mock/devSuggestions';
import type { SuggestionRow, SuggestionStatus } from '@/types/suggestions';

// Reads run under the admin session, so RLS ("Admin read suggestions") is the
// gate — no service-role key is ever in the client. In dev:web the seeded
// session is fake and cannot satisfy RLS, so reads route to the mock store,
// mirroring how societyPosts routes CRUD to devSocietyStore.
export async function listSuggestions(): Promise<SuggestionRow[]> {
  if (DEV_SOCIETY) return devSuggestionsStore.list();
  const { data, error } = await adminAuthClient
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    logError('Api.listSuggestions', error);
    return [];
  }
  return (data ?? []) as SuggestionRow[];
}

// Only `status` is grantable to authenticated (see the migration), so any other
// column in this patch would be rejected by Postgres, not silently written.
export async function setSuggestionStatus(
  id: number,
  status: SuggestionStatus
): Promise<boolean> {
  if (DEV_SOCIETY) {
    devSuggestionsStore.setStatus(id, status);
    return true;
  }
  const { error } = await adminAuthClient.from('suggestions').update({ status }).eq('id', id);
  if (error) {
    logError('Api.setSuggestionStatus', error);
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Write the failing slice test**

Create `src/store/slices/__tests__/createSuggestionsSlice.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSuggestionsSlice, type SuggestionsSlice } from '../createSuggestionsSlice';
import type { SuggestionRow } from '../../../types/suggestions';

const listSuggestions = vi.fn();
const setSuggestionStatus = vi.fn();
vi.mock('../../../api/suggestionsAdmin', () => ({
  listSuggestions: () => listSuggestions(),
  setSuggestionStatus: (id: number, status: string) => setSuggestionStatus(id, status),
}));

function row(id: number, status: SuggestionRow['status']): SuggestionRow {
  return {
    id,
    type: 'bug',
    title: `t${id}`,
    body: 'b',
    contact: null,
    screen: 'exams',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '390x844',
    status,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('createSuggestionsSlice', () => {
  let state: SuggestionsSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listSuggestions.mockReset();
    setSuggestionStatus.mockReset();
    setSuggestionStatus.mockResolvedValue(true);
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createSuggestionsSlice(set, get, {} as any);
  });

  it('starts empty with nothing unread', () => {
    expect(state.suggestions).toEqual([]);
    expect(state.suggestionsUnread).toBe(0);
  });

  it('counts only new items as unread', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'done'), row(3, 'new')]);
    await state.loadSuggestions();
    expect(state.suggestions).toHaveLength(3);
    expect(state.suggestionsUnread).toBe(2);
  });

  it('updates status optimistically and recounts unread', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'new')]);
    await state.loadSuggestions();
    await state.updateSuggestionStatus(1, 'done');
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('done');
    expect(state.suggestionsUnread).toBe(1);
  });

  it('reverts the optimistic update when the write fails', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new')]);
    await state.loadSuggestions();
    setSuggestionStatus.mockResolvedValue(false);
    await state.updateSuggestionStatus(1, 'done');
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('new');
    expect(state.suggestionsUnread).toBe(1);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/store/slices/__tests__/createSuggestionsSlice.test.ts`
Expected: FAIL — cannot resolve `../createSuggestionsSlice`.

- [ ] **Step 4: Implement the slice**

Create `src/store/slices/createSuggestionsSlice.ts`:

```ts
import type { AppSlice } from '../types';
import {
  listSuggestions,
  setSuggestionStatus as apiSetStatus,
} from '../../api/suggestionsAdmin';
import type { SuggestionRow, SuggestionStatus } from '../../types/suggestions';

export interface SuggestionsSlice {
  suggestions: SuggestionRow[];
  suggestionsUnread: number;
  loadSuggestions: () => Promise<void>;
  updateSuggestionStatus: (id: number, status: SuggestionStatus) => Promise<void>;
}

const unread = (rows: SuggestionRow[]): number =>
  rows.filter((r) => r.status === 'new').length;

// Student suggestions, visible only to a reis_admin session. Loaded from the
// admin slice once the role resolves at boot — never from a component effect.
export const createSuggestionsSlice: AppSlice<SuggestionsSlice> = (set, get) => ({
  suggestions: [],
  suggestionsUnread: 0,

  loadSuggestions: async () => {
    const rows = await listSuggestions();
    set({ suggestions: rows, suggestionsUnread: unread(rows) });
  },

  updateSuggestionStatus: async (id, status) => {
    const before = get().suggestions;
    // Optimistic: triaging should feel instant. Reverted below if the write is
    // rejected, so the badge can never claim an item was handled when it wasn't.
    const after = before.map((r) => (r.id === id ? { ...r, status } : r));
    set({ suggestions: after, suggestionsUnread: unread(after) });

    const ok = await apiSetStatus(id, status);
    if (!ok) set({ suggestions: before, suggestionsUnread: unread(before) });
  },
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/store/slices/__tests__/createSuggestionsSlice.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Register the slice**

In `src/store/types.ts`, extend the `AppState` union at line 605 — it currently ends:

```ts
  import('./slices/createAdminSlice').AdminSlice;
```

Change to:

```ts
  import('./slices/createAdminSlice').AdminSlice &
  import('./slices/createSuggestionsSlice').SuggestionsSlice;
```

In `src/store/useAppStore.ts`, add the import beside the other slice imports:

```ts
import { createSuggestionsSlice } from './slices/createSuggestionsSlice';
```

and add to the store composition, after `...createAdminSlice(...a),`:

```ts
  ...createSuggestionsSlice(...a),
```

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npx eslint src/api/suggestionsAdmin.ts src/store/slices/createSuggestionsSlice.ts src/store/slices/__tests__/createSuggestionsSlice.test.ts src/store/types.ts src/store/useAppStore.ts --max-warnings=0
git add src/api/suggestionsAdmin.ts src/store
git commit -m "feat(store): suggestions slice with optimistic status updates"
```

---

### Task 7: Load and announce at boot

**Files:**
- Modify: `src/store/slices/createAdminSlice.ts:66-115`
- Create: `src/components/SocietyAdmin/SuggestionsToast.tsx`
- Modify: `src/components/AppOverlays.tsx`
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts`
- Test: `src/components/SocietyAdmin/__tests__/SuggestionsToast.test.tsx`

**Interfaces:**
- Consumes: `loadSuggestions`, `suggestionsUnread` (Task 6).

**Layering, and why the toast is not in the slice:** no slice or service in this
codebase imports `sonner` or does translation — `toast` and `t()` are strictly
component-level, and `t` does not exist on the store at all. So the slice only
loads; a render-less component announces.

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/__tests__/createAdminSlice.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminSlice } from '../createAdminSlice';

const getSession = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();

vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: {
      getSession: () => getSession(),
      signOut: () => signOut(),
      signInWithPassword: vi.fn(),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
    }),
  },
}));
vi.mock('../../../api/societyPosts', () => ({ listMyPosts: vi.fn().mockResolvedValue([]) }));

describe('createAdminSlice boot', () => {
  let state: Record<string, unknown>;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  const loadSuggestions = vi.fn();

  beforeEach(() => {
    loadSuggestions.mockReset();
    loadSuggestions.mockResolvedValue(undefined);
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = { ...createAdminSlice(set as any, get as any, {} as any), loadSuggestions,
      suggestionsUnread: 0, setMapMode: vi.fn(), focusCampus: vi.fn(),
      refreshSocietyMapEvents: vi.fn() };
  });

  it('loads suggestions for a reis_admin session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'reis.mendelu@gmail.com' } } } });
    maybeSingle.mockResolvedValue({ data: { role: 'reis_admin', association_id: null }, error: null });
    await (state.loadAdminSession as () => Promise<void>)();
    expect(loadSuggestions).toHaveBeenCalledTimes(1);
  });

  it('does not load suggestions for an association session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'admin@supef.cz' } } } });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'supef' }, error: null });
    await (state.loadAdminSession as () => Promise<void>)();
    expect(loadSuggestions).not.toHaveBeenCalled();
  });

  it('does nothing when there is no stored session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await (state.loadAdminSession as () => Promise<void>)();
    expect(loadSuggestions).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`
Expected: FAIL — `loadSuggestions` is never called.

- [ ] **Step 3: Load the inbox when the role resolves**

In `src/store/slices/createAdminSlice.ts`, in `loadAdminSession`, after
`set({ adminSession: data.session, adminRole: role, adminAssociationId: associationId });`
and before `await get().loadSocietyPosts();`, insert:

```ts
    // Pull the inbox as soon as the role is known. This is a pull, not a push:
    // nothing arrives while the iframe is closed, so the count is refreshed at
    // every open and announced by SuggestionsToast.
    if (role === 'reis_admin') await get().loadSuggestions();
```

Apply the same single line at the equivalent point in `adminLogin`, so logging in fresh also loads the inbox.

No `sonner` or `t()` import belongs in this file — see the layering note above.

In `adminLogout`, add `suggestions: []` and `suggestionsUnread: 0` to the reset `set({...})` so a logout does not leave another user's suggestions in memory.

- [ ] **Step 4: Add the translation keys**

`useTranslation` interpolates **single** braces via `result.replace(/\{(\w+)\}/g, …)` — `{count}`, not `{{count}}`. Double braces would render literally.

`src/i18n/locales/en.json`, in `admin`:

```json
"newSuggestions": "{count} new suggestion(s) from students"
```

`src/i18n/locales/cs.json`, in `admin`:

```json
"newSuggestions": "Nové návrhy od studentů: {count}"
```

The Czech string is phrased to sidestep Czech plural agreement (`1 nový návrh` / `2 nové návrhy` / `5 nových návrhů`), which this `t()` has no machinery for.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the failing toast test**

Create `src/components/SocietyAdmin/__tests__/SuggestionsToast.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SuggestionsToast } from '../SuggestionsToast';

const toastInfo = vi.fn();
vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => toastInfo(...a) } }));

describe('SuggestionsToast', () => {
  beforeEach(() => {
    toastInfo.mockReset();
    useAppStore.setState({ language: 'en', adminRole: null, suggestionsUnread: 0 });
  });

  it('says nothing to a student session', () => {
    useAppStore.setState({ adminRole: null, suggestionsUnread: 4 });
    render(<SuggestionsToast />);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('says nothing when a reis_admin has no unread', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 0 });
    render(<SuggestionsToast />);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('announces the unread count to a reis_admin', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 4 });
    render(<SuggestionsToast />);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0][0])).toContain('4');
  });

  it('announces once per mount, not on every store change', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 4 });
    render(<SuggestionsToast />);
    useAppStore.setState({ suggestionsUnread: 5 });
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });

  it('renders nothing', () => {
    const { container } = render(<SuggestionsToast />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `npx vitest run src/components/SocietyAdmin/__tests__/SuggestionsToast.test.tsx`
Expected: FAIL — cannot resolve `../SuggestionsToast`.

- [ ] **Step 8: Implement the toast component**

Create `src/components/SocietyAdmin/SuggestionsToast.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Render-less. Announces untriaged suggestions once per app open to a reIS
// admin. Toasts and t() live in components in this codebase — never in slices,
// which have no access to `t` at all. The ref guard keeps a later store change
// (marking one triaged) from re-firing the announcement mid-session.
export function SuggestionsToast() {
  const unread = useAppStore((s) => (s.adminRole === 'reis_admin' ? s.suggestionsUnread : 0));
  const { t } = useTranslation();
  const announced = useRef(false);

  useEffect(() => {
    if (announced.current || unread === 0) return;
    announced.current = true;
    toast.info(t('admin.newSuggestions', { count: unread }));
  }, [unread, t]);

  return null;
}
```

The ref is read inside the effect, never during render — the project's `react-hooks` rules ban render-time ref access.

- [ ] **Step 9: Mount it**

In `src/components/AppOverlays.tsx`, add the import beside `SocietyAdminOverlay`:

```tsx
import { SuggestionsToast } from './SocietyAdmin/SuggestionsToast';
```

and render it next to `<SocietyAdminOverlay />`:

```tsx
      <SocietyAdminOverlay />
      <SuggestionsToast />
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/components/SocietyAdmin src/store/slices/__tests__/createAdminSlice.test.ts`
Expected: PASS — 5 new toast tests, 3 admin-slice tests, and the 3 pre-existing overlay tests.

- [ ] **Step 11: Lint and commit**

```bash
npx eslint src/store/slices/createAdminSlice.ts src/store/slices/__tests__/createAdminSlice.test.ts src/components/SocietyAdmin/SuggestionsToast.tsx src/components/SocietyAdmin/__tests__/SuggestionsToast.test.tsx src/components/AppOverlays.tsx --max-warnings=0
git add src/store/slices/createAdminSlice.ts src/store/slices/__tests__/createAdminSlice.test.ts src/components/SocietyAdmin src/components/AppOverlays.tsx src/i18n
git commit -m "feat(admin): load suggestions at boot and announce unread once per open"
```

---

### Task 8: The inbox UI

**Files:**
- Create: `src/components/SocietyAdmin/SuggestionsInbox.tsx`
- Modify: `src/components/SocietyAdmin/SocietyAdminOverlay.tsx:20-28`
- Test: `src/components/SocietyAdmin/__tests__/SuggestionsInbox.test.tsx`

**Interfaces:**
- Consumes: `suggestions`, `updateSuggestionStatus` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/components/SocietyAdmin/__tests__/SuggestionsInbox.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SuggestionsInbox } from '../SuggestionsInbox';
import type { SuggestionRow } from '../../../types/suggestions';

const row: SuggestionRow = {
  id: 1,
  type: 'bug',
  title: 'Exams empty',
  body: 'Panel stayed empty after enrolling',
  contact: 'student@mendelu.cz',
  screen: 'exams',
  ext_version: '4.0.0',
  browser_name: 'Chrome',
  browser_version: '131',
  viewport: '390x844',
  status: 'new',
  created_at: '2026-08-01T00:00:00.000Z',
};

describe('SuggestionsInbox', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en', suggestions: [], suggestionsUnread: 0 });
  });

  it('shows an empty state when there is nothing', () => {
    render(<SuggestionsInbox />);
    expect(screen.getByText(/No suggestions yet/i)).toBeInTheDocument();
  });

  it('renders a suggestion with its screen and contact', () => {
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1 });
    render(<SuggestionsInbox />);
    expect(screen.getByText('Exams empty')).toBeInTheDocument();
    expect(screen.getByText(/exams/)).toBeInTheDocument();
    expect(screen.getByText('student@mendelu.cz')).toBeInTheDocument();
  });

  it('marks a suggestion done through the store', () => {
    const updateSuggestionStatus = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1, updateSuggestionStatus });
    render(<SuggestionsInbox />);
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(updateSuggestionStatus).toHaveBeenCalledWith(1, 'done');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/components/SocietyAdmin/__tests__/SuggestionsInbox.test.tsx`
Expected: FAIL — cannot resolve `../SuggestionsInbox`.

- [ ] **Step 3: Implement the component**

Create `src/components/SocietyAdmin/SuggestionsInbox.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { SuggestionRow } from '../../types/suggestions';

const TYPE_BADGE: Record<SuggestionRow['type'], string> = {
  bug: 'badge-error',
  idea: 'badge-warning',
  other: 'badge-ghost',
};

export function SuggestionsInbox() {
  const items = useAppStore((s) => s.suggestions);
  const update = useAppStore((s) => s.updateSuggestionStatus);
  const { t } = useTranslation();

  if (items.length === 0) {
    return <p className="text-sm text-base-content/60 py-6 text-center">{t('admin.noSuggestions')}</p>;
  }

  return (
    <ul className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
      {items.map((s) => (
        <li
          key={s.id}
          className={`rounded-lg border border-base-300 p-3 ${
            s.status === 'new' ? 'bg-base-200' : 'bg-base-100 opacity-60'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm break-words">{s.title}</span>
            <span className={`badge badge-sm shrink-0 ${TYPE_BADGE[s.type]}`}>{s.type}</span>
          </div>
          <p className="text-xs text-base-content/70 mt-1 whitespace-pre-wrap break-words">
            {s.body}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-base-content/50">
            <span>{s.screen}</span>
            <span>
              {s.browser_name} {s.browser_version}
            </span>
            <span>{s.viewport}</span>
            <span>{new Date(s.created_at).toLocaleDateString()}</span>
            {s.contact && <span className="break-all">{s.contact}</span>}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => void update(s.id, 'triaged')}
              disabled={s.status !== 'new'}
            >
              {t('admin.markTriaged')}
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => void update(s.id, 'done')}
              disabled={s.status === 'done'}
            >
              {t('admin.markDone')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Add the translation keys**

`en.json` under `admin`: `"noSuggestions": "No suggestions yet."`, `"markTriaged": "Triaged"`, `"markDone": "Done"`, `"suggestionsTitle": "Student suggestions"`.
`cs.json` under `admin`: `"noSuggestions": "Zatím žádné návrhy."`, `"markTriaged": "Zpracováno"`, `"markDone": "Hotovo"`, `"suggestionsTitle": "Návrhy studentů"`.

- [ ] **Step 5: Show it in the overlay**

In `src/components/SocietyAdmin/SocietyAdminOverlay.tsx`, add the import:

```tsx
import { SuggestionsInbox } from './SuggestionsInbox';
```

and replace the logged-in branch (the `<>...</>` containing `reisAdminNote` and the logout button) with:

```tsx
          <>
            <p className="text-sm text-base-content/70">{t('admin.reisAdminNote')}</p>
            <h4 className="font-semibold text-sm mt-4 mb-2">{t('admin.suggestionsTitle')}</h4>
            <SuggestionsInbox />
            <button className="btn btn-ghost btn-sm mt-4" onClick={() => void logout()}>
              {t('admin.logout')}
            </button>
          </>
```

- [ ] **Step 6: Run both suites**

Run: `npx vitest run src/components/SocietyAdmin`
Expected: PASS — the 3 new tests plus the 3 pre-existing overlay tests, which must still pass (the `reisAdminNote` assertion is unchanged).

- [ ] **Step 7: Lint and commit**

```bash
npx eslint src/components/SocietyAdmin --ext .ts,.tsx --max-warnings=0
git add src/components/SocietyAdmin src/i18n
git commit -m "feat(admin): suggestions inbox replaces the dead-end reis-admin note"
```

---

### Task 9: Unread badge on the profile entry point

The entry point is a **hidden triple-click** on the profile badge. The count renders only for an existing `reis_admin` session — a session a student can never hold — so the door stays hidden.

**Files:**
- Modify: `src/components/Sidebar/ProfilePopup.tsx:43-75`
- Modify: `src/components/MobileNav/MobileProfileSheet.tsx:39-40` (same pattern)
- Test: `src/components/Sidebar/__tests__/ProfilePopup.suggestions.test.tsx`

**Interfaces:**
- Consumes: `suggestionsUnread`, `adminRole` (Tasks 6 and existing admin slice).

- [ ] **Step 1: Write the failing test**

Create `src/components/Sidebar/__tests__/ProfilePopup.suggestions.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ProfilePopup } from '../ProfilePopup';

describe('ProfilePopup suggestions badge', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en', adminRole: null, suggestionsUnread: 3 });
  });

  it('hides the badge from a student session', () => {
    render(<ProfilePopup isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('suggestions-badge')).not.toBeInTheDocument();
  });

  it('shows the unread count for a reis_admin session', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 3 });
    render(<ProfilePopup isOpen onClose={() => {}} />);
    expect(screen.getByTestId('suggestions-badge')).toHaveTextContent('3');
  });

  it('hides the badge when a reis_admin has nothing unread', () => {
    useAppStore.setState({ adminRole: 'reis_admin', suggestionsUnread: 0 });
    render(<ProfilePopup isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('suggestions-badge')).not.toBeInTheDocument();
  });
});
```

`ProfilePopup`'s signature is `{ isOpen: boolean; onOpenFeedback?: () => void; onClose?: () => void; isIskam?: boolean }` — `isOpen` alone is enough, as used above.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/components/Sidebar/__tests__/ProfilePopup.suggestions.test.tsx`
Expected: FAIL — no element with `data-testid="suggestions-badge"`.

- [ ] **Step 3: Add the badge**

In `src/components/Sidebar/ProfilePopup.tsx`, after the existing `onBadge` line:

```tsx
  const unread = useAppStore((s) => (s.adminRole === 'reis_admin' ? s.suggestionsUnread : 0));
```

and wrap the triple-click target (the `<span onClick={onBadge}>` around `t('settings.studentId')`) so the count sits beside it:

```tsx
                <span onClick={onBadge} className="opacity-70">
                  {t('settings.studentId')}
                </span>
                {unread > 0 && (
                  <span data-testid="suggestions-badge" className="badge badge-primary badge-xs">
                    {unread}
                  </span>
                )}
```

Apply the identical `unread` selector and badge to `src/components/MobileNav/MobileProfileSheet.tsx` at its own `onBadge` site.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/Sidebar src/components/MobileNav`
Expected: PASS, including pre-existing tests in both directories.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/components/Sidebar/ProfilePopup.tsx src/components/MobileNav/MobileProfileSheet.tsx src/components/Sidebar/__tests__/ProfilePopup.suggestions.test.tsx --max-warnings=0
git add src/components/Sidebar src/components/MobileNav
git commit -m "feat(admin): unread suggestions badge, visible only to reis_admin"
```

---

### Task 10: Full verification

**Files:** none created; this task proves the whole thing works.

- [ ] **Step 1: Whole suite, typecheck, lint**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all green. Any failure here is a regression from Tasks 1-9, not pre-existing — the baseline was confirmed clean in Task 1 Step 1.

- [ ] **Step 2: Drive the real UI in the dev webapp**

```bash
VITE_DEV_SOCIETY=reis VITE_DEV_ADMIN_ROLE=reis_admin npm run dev:web
```

Open `localhost:3000`, triple-click the student-ID row in the profile popup, and confirm: the overlay shows the two mock suggestions, the unread badge reads `1`, "Done" greys the row out and drops the badge.

- [ ] **Step 3: Measure the UI, don't eyeball it**

Use the `verify-ui` skill at 320/390/430. The inbox renders student-authored text of arbitrary length inside a `max-w-md` modal, so **overflow is the live risk** — a 2000-character body and a 120-character title with no spaces are the cases to check. Confirm no horizontal overflow and no contrast failures in the dark theme.

- [ ] **Step 4: End-to-end against the real backend**

Temporarily unset `VITE_DEV_SOCIETY`, submit a suggestion from the feedback modal, and confirm the row lands:

```sql
select id, type, title, screen, status, created_at from public.suggestions order by id desc limit 5;
```

Confirm `screen` holds an `AppView` value and that **no column contains an `is.mendelu.cz` URL**. Then delete the test row.

- [ ] **Step 5: Confirm the credential is gone from the bundle**

```bash
npm run build
grep -r "discord.com/api/webhooks" .output/ && echo "LEAK — investigate" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test: verify suggestions inbox end-to-end"
```

---

## Post-implementation

- The Discord webhook delete is a **human step and a prerequisite**, not a follow-up. If it has not happened by the time this plan completes, do it now — nothing in this codebase can revoke it.
- Ship via the normal `/release` flow.
- Not addressed here, tracked separately: the unhashed `studentId` in `createStudyJamsSlice`, and GitHub secret scanning not recognising Discord webhook URLs.
