# Society Password Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This session executes inline via superpowers:executing-plans** — it is configured not to dispatch subagents unless explicitly asked.

**Goal:** Let a reIS admin reset any society's password, and any logged-in society change its own, from inside the extension — with societies logging in by plain name (`supef`) instead of an email address.

**Architecture:** Usernames map to synthetic `@societies.invalid` addresses through a single function, so Supabase Auth still sees an email while societies never do. Authorization moves off the JWT email string onto `auth.uid()` behind a real foreign key to `auth.users`. Admin resets run in a `service_role` Edge Function that verifies the caller is `reis_admin` server-side; society self-service is a plain client call needing no privileged infrastructure.

**Tech Stack:** WXT + React + Zustand, Supabase (Postgres RLS, Auth, Deno Edge Functions), vitest, DaisyUI.

**Spec:** `docs/superpowers/specs/2026-08-31-society-password-management-design.md`

## Global Constraints

- Supabase project ref: `zvbpgkmnrqyprtkyxkwn`.
- `service_role` key lives ONLY in the Edge Function environment. Never in the client bundle, never in a migration, never in a test fixture.
- Max 200 lines per file. Split proactively.
- No `localStorage` / `sessionStorage` — session storage goes through `chromeStorageAdapter`.
- No custom CSS. DaisyUI semantic classes only (`btn-primary`, `bg-base-200`).
- Direct imports only. No re-export barrels.
- Test first: write the failing test, watch it fail, then implement.
- App language codes are `'cz' | 'en'`; locale FILES are `cs.json` / `en.json`. Do not add a `cs`→`cz` mapping.
- Generated passwords are returned exactly once and never persisted or logged.
- The synthetic domain is exactly `societies.invalid` (RFC 2606 reserved, unroutable).

---

## Prerequisite: regain access to `reis_admin`

Every task below is verified while signed in as `reis_admin`, and that is the
account currently locked out. Do this first or nothing downstream is testable.

- [ ] **Step 1: Point Auth Site URL at an origin that loads**

Supabase → Authentication → URL Configuration → Site URL. `reismendelu.app` is
registered but its DNS zone is completely empty, so every recovery and magic link
resolves to nothing — that is why the existing links die. Set it to
`http://localhost:8080` (the retiring reis-admin console, whose Supabase client
uses the default `detectSessionInUrl`, so a recovery fragment establishes a
session on arrival).

- [ ] **Step 2: Start that console**

```bash
cd /Users/dominik-personal/Documents/reis-admin && npm run dev
```

Its `.env` is already written with the project URL and publishable key.

- [ ] **Step 3: Send and complete the recovery**

Authentication → Users → `reis.mendelu@gmail.com` → Send password recovery. It is
the one real mailbox on the project. Open the link, land on `localhost:8080` with a
live session, and set a password.

- [ ] **Step 4: Confirm the role resolves**

```sql
select public.get_my_role();
```
Expected while signed in as that account: `reis_admin`.

---

### Task 1: Username → auth address mapping

**Files:**
- Modify: `src/services/admin/societyLogin.ts`
- Test: `src/services/admin/__tests__/societyLogin.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toAuthEmail(input: string): string` and `SOCIETY_EMAIL_DOMAIN: string`. Task 2 and Task 5 both call `toAuthEmail`.

- [ ] **Step 1: Write the failing test**

Add to `src/services/admin/__tests__/societyLogin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toAuthEmail, SOCIETY_EMAIL_DOMAIN } from '../societyLogin';

describe('toAuthEmail', () => {
  it('maps a bare username to the synthetic domain', () => {
    expect(toAuthEmail('supef')).toBe('supef@societies.invalid');
  });

  it('normalises casing and surrounding whitespace', () => {
    expect(toAuthEmail('  SuPeF \n')).toBe('supef@societies.invalid');
  });

  it('passes a full address through unchanged (break-glass admin)', () => {
    expect(toAuthEmail('reis.mendelu@gmail.com')).toBe('reis.mendelu@gmail.com');
  });

  it('lowercases a passed-through address', () => {
    expect(toAuthEmail(' REIS.Mendelu@Gmail.com ')).toBe('reis.mendelu@gmail.com');
  });

  it('rejects a username with characters that cannot appear in an address', () => {
    expect(() => toAuthEmail('su pef')).toThrow(/invalid username/i);
    expect(() => toAuthEmail('supef!')).toThrow(/invalid username/i);
  });

  it('rejects an empty username', () => {
    expect(() => toAuthEmail('   ')).toThrow(/invalid username/i);
  });

  it('exports the domain it uses', () => {
    expect(SOCIETY_EMAIL_DOMAIN).toBe('societies.invalid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/admin/__tests__/societyLogin.test.ts`
Expected: FAIL — `toAuthEmail` is not exported from `../societyLogin`.

- [ ] **Step 3: Write minimal implementation**

Replace the body of `src/services/admin/societyLogin.ts` with:

```ts
/**
 * Societies sign in with a plain name ("supef"), not an address. Supabase Auth
 * has no username credential — email, phone, OAuth, SSO, anonymous and Web3 are
 * the only ones — so a username is mapped to a synthetic address here, and ONLY
 * here. Nothing else in the codebase may construct a login address.
 *
 * `.invalid` is reserved by RFC 2606 and can never route mail. That is the
 * point: these accounts are recovered by a reIS admin, not by email, and an
 * unroutable domain says so honestly instead of impersonating a real one the way
 * the old `admin@esn.cz` addresses did.
 *
 * Break-glass exception: an input that already contains "@" passes through. The
 * reis_admin account keeps a real mailbox, because it is the only role allowed to
 * reset anyone — if it locks itself out, nothing in this feature can recover it.
 */
export const SOCIETY_EMAIL_DOMAIN = 'societies.invalid';

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

export function toAuthEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  if (!USERNAME_RE.test(trimmed)) {
    throw new Error(`invalid username: ${JSON.stringify(input)}`);
  }
  return `${trimmed}@${SOCIETY_EMAIL_DOMAIN}`;
}
```

Delete the old `normalizeEmail` export only after Task 2 stops importing it — for
now leave it in place beneath the new code.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/admin/__tests__/societyLogin.test.ts`
Expected: PASS, all 7 assertions.

- [ ] **Step 5: Commit**

```bash
git add src/services/admin/societyLogin.ts src/services/admin/__tests__/societyLogin.test.ts
git commit -m "feat(admin): map society usernames to synthetic auth addresses"
```

---

### Task 2: Log in by username

**Files:**
- Modify: `src/store/slices/createAdminSlice.ts` (the `adminLogin` action and its `normalizeEmail` import)
- Modify: `src/components/AdminConsole/SocietyLoginForm.tsx`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts`

**Interfaces:**
- Consumes: `toAuthEmail` from Task 1.
- Produces: `adminLogin(username: string, password: string)` — the first argument is now a username OR a full address, no longer an address only.

- [ ] **Step 1: Write the failing test**

Add to `src/store/slices/__tests__/createAdminSlice.test.ts`, inside the existing top-level `describe`:

```ts
it('signs in with the synthetic address built from a username', async () => {
  signIn.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null });
  maybeSingle.mockResolvedValueOnce({
    data: { role: 'association', association_id: 'supef' },
    error: null,
  });

  const state = makeState();
  await state.adminLogin('supef', 'pw');

  expect(signIn).toHaveBeenCalledWith({
    email: 'supef@societies.invalid',
    password: 'pw',
  });
});

it('returns invalid_credentials for a malformed username without calling Supabase', async () => {
  const state = makeState();
  const res = await state.adminLogin('su pef', 'pw');

  expect(res.error).toBe('invalid_credentials');
  expect(signIn).not.toHaveBeenCalled();
});
```

`makeState()` is the existing local-harness helper in this file — reuse it exactly
as the neighbouring tests do rather than building a new one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`
Expected: FAIL — the first test sees `email: 'supef'` (old `normalizeEmail` behaviour); the second throws instead of returning `invalid_credentials`.

- [ ] **Step 3: Write minimal implementation**

In `src/store/slices/createAdminSlice.ts`, change the import:

```ts
import { toAuthEmail } from '../../services/admin/societyLogin';
```

and replace the first two lines of `adminLogin` with:

```ts
  adminLogin: async (usernameInput, password) => {
    let email: string;
    try {
      email = toAuthEmail(usernameInput);
    } catch {
      // A malformed username can never match an account. Fail like a wrong
      // password rather than surfacing a distinct error that would let someone
      // probe which names are well-formed.
      return { error: 'invalid_credentials' };
    }
    const { data, error } = await adminAuthClient.auth.signInWithPassword({ email, password });
```

Update the `AdminSlice` interface comment and signature:

```ts
  /** `username` is a society name ("supef") or, for the break-glass admin, a full address. */
  adminLogin: (username: string, password: string) => Promise<{ error?: string }>;
```

Then delete `normalizeEmail` from `src/services/admin/societyLogin.ts` and remove
its now-unused test if one exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts src/services/admin/__tests__/societyLogin.test.ts`
Expected: PASS.

- [ ] **Step 5: Swap the login form field**

In `src/components/AdminConsole/SocietyLoginForm.tsx`: rename the `email` state to
`username`, change the header comment's "real email on their account (e.g.
admin@supef.cz)" to "society name (e.g. supef)", and replace the first `<label>`:

```tsx
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.username')}</span>
        <input
          aria-label={t('admin.username')}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="input input-bordered"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />
      </label>
```

Update the two `!email.trim()` guards to `!username.trim()` and the
`adminLogin(email, password)` call to `adminLogin(username, password)`.

- [ ] **Step 6: Add the strings**

In `src/i18n/locales/cs.json` under `admin`, add `"username": "Název spolku"` and
change `"loginError"` to `"Neplatné jméno nebo heslo"`. In
`src/i18n/locales/en.json` under `admin`, add `"username": "Society name"` and
change `"loginError"` to `"Invalid name or password"`. Leave the now-unused
`admin.email` key in both files — Task 7 reuses it for the account panel.

- [ ] **Step 7: Verify the whole admin suite**

Run: `npx vitest run src/store/slices/__tests__ src/components/AdminConsole src/services/admin`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/store/slices/createAdminSlice.ts src/components/AdminConsole/SocietyLoginForm.tsx src/services/admin/societyLogin.ts src/i18n/locales/cs.json src/i18n/locales/en.json src/store/slices/__tests__/createAdminSlice.test.ts
git commit -m "feat(admin): societies log in by name instead of email"
```

---

### Task 3: Remove the unused societies, then re-key authorization to auth.uid()

**Files:**
- Create: `supabase/migrations/20260831120000_rekey_society_auth_to_uid.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.spolky_accounts.user_id uuid` (NOT NULL, UNIQUE, FK to `auth.users(id)` ON DELETE CASCADE); `public.get_my_role() → text`; `public.get_my_association() → text`. Tasks 4 and 5 both depend on these.

**Before the migration runs**, delete the six unused society accounts in the
Supabase dashboard (Authentication → Users): `admin@af-mendelu.cz`,
`admin@au-frrms.cz`, `admin@esn.cz`, `admin@ldf-mendelu.cz`, `admin@supef.cz`,
`admin@zf-mendelu.cz`. Deleting the auth user is the supported path; the migration
below removes their `spolky_accounts` rows. Only `reis.mendelu@gmail.com` survives,
so the backfill has exactly one row to pair.

- [ ] **Step 1: Write the migration**

```sql
-- Re-key society/admin authorization from the JWT email string to auth.uid().
--
-- Before: get_my_role() and five RLS policies resolved permissions with
--   WHERE email = (auth.jwt() ->> 'email')
-- and public.spolky_accounts had NO foreign key to auth.users — its `id` is a
-- standalone PK that does not equal the auth uid. Any JWT carrying a matching
-- email string inherited that row's permissions; self-signup being disabled was
-- the only thing preventing it. After this migration, holding an email string
-- grants nothing.

begin;

-- 1. The six society accounts are unused and their mailboxes never existed.
--    They are re-created through the admin UI with synthetic addresses; their
--    auth.users rows are deleted separately in the dashboard.
delete from public.spolky_accounts
 where association_id in ('af', 'au_frrms', 'esn', 'ldf', 'supef', 'zf');

-- 2. Real identity, backfilled from the surviving email pairing.
alter table public.spolky_accounts
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.spolky_accounts sa
   set user_id = u.id
  from auth.users u
 where lower(trim(u.email)) = lower(trim(sa.email))
   and sa.user_id is null;

-- 3. Abort rather than leave an account that can never authorize.
do $$
declare orphans int;
begin
  select count(*) into orphans from public.spolky_accounts where user_id is null;
  if orphans > 0 then
    raise exception 'aborting: % spolky_accounts row(s) have no matching auth.users row', orphans;
  end if;
end $$;

alter table public.spolky_accounts
  alter column user_id set not null,
  add constraint spolky_accounts_user_id_key unique (user_id);

-- 4. Role and association resolve by uid. SECURITY DEFINER avoids RLS recursion;
--    the pinned search_path stops a caller-supplied path from resolving these
--    names to something else.
create or replace function public.get_my_role()
returns text language sql stable security definer
set search_path = public
as $$
  select role from public.spolky_accounts
   where user_id = auth.uid() and is_active = true
   limit 1;
$$;

create or replace function public.get_my_association()
returns text language sql stable security definer
set search_path = public
as $$
  select association_id from public.spolky_accounts
   where user_id = auth.uid() and is_active = true
   limit 1;
$$;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_my_association() to authenticated;

-- 5. Policies re-pointed at auth.uid().
-- Redundant: auth_read_spolky_accounts is a strict superset of this one.
drop policy if exists "Users read own account" on public.spolky_accounts;

drop policy if exists "auth_read_spolky_accounts" on public.spolky_accounts;
create policy "auth_read_spolky_accounts"
  on public.spolky_accounts for select to authenticated
  using (user_id = auth.uid() or public.get_my_role() = 'reis_admin');

drop policy if exists "auth_delete_spolky_events" on public.spolky_events;
create policy "auth_delete_spolky_events"
  on public.spolky_events for delete to authenticated
  using (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  );

drop policy if exists "auth_insert_spolky_events" on public.spolky_events;
create policy "auth_insert_spolky_events"
  on public.spolky_events for insert to authenticated
  with check (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  );

drop policy if exists "auth_update_spolky_events" on public.spolky_events;
create policy "auth_update_spolky_events"
  on public.spolky_events for update to authenticated
  using (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  )
  with check (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  );

commit;
```

`auth_insert_spolky_accounts` and `auth_update_spolky_accounts` already route
through `get_my_role()` and need no edit — they start resolving by uid for free.

- [ ] **Step 2: Verify the pairing BEFORE applying**

Run this read-only query against the project first. Every row must show
`pairs_to_auth_user = true`, and there must be exactly one row:

```sql
select sa.association_id, sa.email, u.id is not null as pairs_to_auth_user
  from public.spolky_accounts sa
  left join auth.users u on lower(trim(u.email)) = lower(trim(sa.email))
 where sa.association_id not in ('af','au_frrms','esn','ldf','supef','zf');
```

Expected: one row, `reis` / `reis.mendelu@gmail.com` / `true`.
If it is false, STOP — the migration's guard will abort and the transaction will
roll back, but diagnose the mismatch before retrying.

- [ ] **Step 3: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name:
`rekey_society_auth_to_uid`) or `supabase db push`.
Expected: success, no exception raised.

- [ ] **Step 4: Verify the new state**

```sql
select count(*) as policies_still_keyed_on_email
  from pg_policies
 where schemaname = 'public'
   and (qual like '%jwt%email%' or with_check like '%jwt%email%');
```

Expected: `0`.

```sql
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.spolky_accounts'::regclass and contype = 'f';
```

Expected: one row, a foreign key to `auth.users(id)` with `ON DELETE CASCADE`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260831120000_rekey_society_auth_to_uid.sql
git commit -m "feat(db): key society authorization to auth.uid() behind a real FK"
```

---

### Task 4: Resolve the account by uid

**Files:**
- Modify: `src/store/slices/createAdminSlice.ts` (`resolveAccount` and its call site)
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts`

**Interfaces:**
- Consumes: `spolky_accounts.user_id` from Task 3.
- Produces: `resolveAccount(userId: string)` — signature changes from email to uid.

- [ ] **Step 1: Write the failing test**

```ts
it('resolves the account by user id, not by email', async () => {
  signIn.mockResolvedValueOnce({
    data: { session: { user: { id: 'uid-123' } } },
    error: null,
  });
  maybeSingle.mockResolvedValueOnce({
    data: { role: 'association', association_id: 'supef' },
    error: null,
  });

  const state = makeState();
  await state.adminLogin('supef', 'pw');

  expect(eqSpy).toHaveBeenCalledWith('user_id', 'uid-123');
});
```

This needs the module mock to expose the `.eq()` argument. Change the
`vi.mock('../../../services/admin/authClient', …)` block at the top of the file so
`from()` records it:

```ts
const eqSpy = vi.fn();
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signIn(...a),
      getSession: () => getSession(),
      signOut: () => signOut(),
    },
    from: () => ({
      select: () => ({
        eq: (...a: unknown[]) => {
          eqSpy(...a);
          return { maybeSingle: () => maybeSingle(), order: () => order() };
        },
      }),
    }),
  },
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts -t 'by user id'`
Expected: FAIL — `eqSpy` was called with `('email', 'supef@societies.invalid')`.

- [ ] **Step 3: Write minimal implementation**

```ts
async function resolveAccount(
  userId: string
): Promise<{ role: AdminRole | null; associationId: string | null }> {
  const { data, error } = await adminAuthClient
    .from('spolky_accounts')
    .select('role, association_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) logError('Admin.resolveAccount', error);
  return { role: (data?.role as AdminRole) ?? null, associationId: data?.association_id ?? null };
}
```

And at the call site in `adminLogin`:

```ts
    const { role, associationId } = await resolveAccount(data.session.user.id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/createAdminSlice.ts src/store/slices/__tests__/createAdminSlice.test.ts
git commit -m "feat(admin): resolve society account by auth uid"
```

---

### Task 5: `society-accounts` Edge Function

**Files:**
- Create: `supabase/functions/society-accounts/index.ts`
- Create: `supabase/functions/society-accounts/password.ts`
- Test: `supabase/functions/society-accounts/__tests__/password.test.ts`

**Interfaces:**
- Consumes: `get_my_role()` from Task 3; `SOCIETY_EMAIL_DOMAIN` semantics from Task 1 (the Deno function re-declares the mapping locally — it cannot import from `src/`).
- Produces: HTTP POST endpoint accepting `{ action, username, associationName?, role? }` and returning `{ password }` for `create` and `reset`. Task 6 calls it.

Split across two files so the password generator is unit-testable without Deno
HTTP plumbing, and so neither file approaches 200 lines.

- [ ] **Step 1: Write the failing test for the generator**

`supabase/functions/society-accounts/__tests__/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generatePassword, toAuthEmail } from '../password';

describe('generatePassword', () => {
  it('is 20 characters', () => {
    expect(generatePassword()).toHaveLength(20);
  });

  it('avoids visually ambiguous characters', () => {
    const joined = Array.from({ length: 50 }, generatePassword).join('');
    expect(joined).not.toMatch(/[O0Il1]/);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, generatePassword));
    expect(seen.size).toBe(200);
  });
});

describe('toAuthEmail (function copy)', () => {
  it('matches the client mapping', () => {
    expect(toAuthEmail('supef')).toBe('supef@societies.invalid');
  });

  it('rejects a malformed username', () => {
    expect(() => toAuthEmail('su pef')).toThrow(/invalid username/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/society-accounts/__tests__/password.test.ts`
Expected: FAIL — `../password` does not exist.

- [ ] **Step 3: Write the generator**

`supabase/functions/society-accounts/password.ts`:

```ts
// Deliberately excludes O/0/I/l/1 — these passwords get read aloud and retyped
// by society committees, and an ambiguous glyph turns into a support request.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const LENGTH = 20;

export function generatePassword(): string {
  const bytes = new Uint32Array(LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Mirror of src/services/admin/societyLogin.ts. A Deno Edge Function cannot
// import from src/, so this is a deliberate copy — change both together.
export const SOCIETY_EMAIL_DOMAIN = 'societies.invalid';
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

export function toAuthEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  if (!USERNAME_RE.test(trimmed)) {
    throw new Error(`invalid username: ${JSON.stringify(input)}`);
  }
  return `${trimmed}@${SOCIETY_EMAIL_DOMAIN}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/society-accounts/__tests__/password.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the handler**

`supabase/functions/society-accounts/index.ts`:

```ts
// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generatePassword, toAuthEmail } from './password.ts';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// @ts-ignore
const PUBLISHABLE = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !PUBLISHABLE) return json({ error: 'misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  // The caller's own JWT, so get_my_role() resolves via auth.uid(). The database
  // is the source of truth for who is an admin — this function never trusts a
  // role claim from the request body.
  const asCaller = createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: role, error: roleErr } = await asCaller.rpc('get_my_role');
  if (roleErr || role !== 'reis_admin') return json({ error: 'forbidden' }, 403);

  let body: { action?: string; username?: string; associationName?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const { action, username } = body;
  if (!action || !username) return json({ error: 'bad_request' }, 400);

  let email: string;
  try {
    email = toAuthEmail(username);
  } catch {
    return json({ error: 'invalid_username' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'create') {
    const password = generatePassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) return json({ error: 'create_failed' }, 400);

    // Same call, so the auth user and the account row cannot diverge. If the
    // insert fails the auth user is removed again rather than left orphaned.
    const { error: rowErr } = await admin.from('spolky_accounts').insert({
      user_id: created.user.id,
      email,
      association_id: username.trim().toLowerCase(),
      association_name: body.associationName ?? username,
      role: body.role === 'reis_admin' ? 'reis_admin' : 'association',
      is_active: true,
    });
    if (rowErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: 'create_failed' }, 400);
    }
    return json({ password });
  }

  const { data: account, error: lookupErr } = await admin
    .from('spolky_accounts')
    .select('user_id')
    .eq('association_id', username.trim().toLowerCase())
    .maybeSingle();
  if (lookupErr || !account) return json({ error: 'not_found' }, 404);

  if (action === 'reset') {
    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(account.user_id, { password });
    if (error) return json({ error: 'reset_failed' }, 400);
    return json({ password });
  }

  if (action === 'deactivate') {
    const { error } = await admin
      .from('spolky_accounts')
      .update({ is_active: false })
      .eq('user_id', account.user_id);
    if (error) return json({ error: 'update_failed' }, 400);
    return json({ ok: true });
  }

  if (action === 'delete') {
    // The spolky_accounts row goes with it via ON DELETE CASCADE.
    const { error } = await admin.auth.admin.deleteUser(account.user_id);
    if (error) return json({ error: 'delete_failed' }, 400);
    return json({ ok: true });
  }

  return json({ error: 'bad_request' }, 400);
});
```

- [x] **Step 6: No function secret needed** *(revised during implementation)*

The original plan set `SUPABASE_PUBLISHABLE_KEY` as a function secret so a
caller-scoped client could call `get_my_role()`. That needed the Supabase CLI,
which is not installed here, and the project's legacy anon key is disabled so
there is no fallback. The function was refactored instead to verify the caller
with `admin.auth.getUser(token)` — which validates the JWT against the Auth
server — and then read the role from the database by the *verified* uid. It now
runs on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` alone, both injected by
the platform. No secret to set, and one less thing to misconfigure.

- [ ] **Step 7: Deploy and verify the authorization gate**

Deploy via the Supabase MCP `deploy_edge_function` tool or
`supabase functions deploy society-accounts`.

Then verify it refuses an unauthenticated caller:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://zvbpgkmnrqyprtkyxkwn.supabase.co/functions/v1/society-accounts \
  -H 'Content-Type: application/json' \
  -d '{"action":"reset","username":"supef"}'
```

Expected: `401`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/society-accounts/
git commit -m "feat(admin): society-accounts edge function for admin password resets"
```

---

### Task 6: Admin reset UI

**Files:**
- Create: `src/components/AdminConsole/SocietyAccountsPanel.tsx`
- Create: `src/components/AdminConsole/GeneratedPasswordDialog.tsx`
- Create: `src/api/societyAccounts.ts`
- Modify: `src/components/AdminConsole/AdminConsole.tsx` (add the panel behind the reis_admin check)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/components/AdminConsole/__tests__/SocietyAccountsPanel.test.tsx`

**Interfaces:**
- Consumes: the Edge Function from Task 5.
- Produces: `resetSocietyPassword(username: string): Promise<{ password?: string; error?: string }>` from `src/api/societyAccounts.ts`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SocietyAccountsPanel } from '../SocietyAccountsPanel';

const resetSocietyPassword = vi.fn();
vi.mock('../../../api/societyAccounts', () => ({
  resetSocietyPassword: (...a: unknown[]) => resetSocietyPassword(...a),
  listSocietyAccounts: vi.fn().mockResolvedValue([
    { association_id: 'supef', association_name: 'SUPEF', is_active: true },
  ]),
}));

beforeEach(() => vi.clearAllMocks());

describe('SocietyAccountsPanel', () => {
  it('shows the generated password exactly once after a reset', async () => {
    resetSocietyPassword.mockResolvedValueOnce({ password: 'Abcd2345Efgh6789Jkmn' });
    render(<SocietyAccountsPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /supef/i }));
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(await screen.findByText('Abcd2345Efgh6789Jkmn')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close|zavřít/i }));
    expect(screen.queryByText('Abcd2345Efgh6789Jkmn')).not.toBeInTheDocument();
  });

  it('surfaces an error without showing a password', async () => {
    resetSocietyPassword.mockResolvedValueOnce({ error: 'forbidden' });
    render(<SocietyAccountsPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /supef/i }));
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AdminConsole/__tests__/SocietyAccountsPanel.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Write the API wrapper**

`src/api/societyAccounts.ts`:

```ts
import { adminAuthClient } from '../services/admin/authClient';
import { logError } from '../utils/reportError';

export interface SocietyAccountRow {
  association_id: string;
  association_name: string;
  is_active: boolean;
}

export async function listSocietyAccounts(): Promise<SocietyAccountRow[]> {
  const { data, error } = await adminAuthClient
    .from('spolky_accounts')
    .select('association_id, association_name, is_active')
    .order('association_name');
  if (error) {
    logError('Api.listSocietyAccounts', error);
    return [];
  }
  return (data ?? []) as SocietyAccountRow[];
}

/**
 * Returns the generated password ONCE. It is never stored, never logged, and
 * never sent anywhere else — the caller shows it and drops it.
 */
export async function resetSocietyPassword(
  username: string
): Promise<{ password?: string; error?: string }> {
  const { data, error } = await adminAuthClient.functions.invoke('society-accounts', {
    body: { action: 'reset', username },
  });
  if (error) {
    logError('Api.resetSocietyPassword', error);
    return { error: 'reset_failed' };
  }
  if (data?.error) return { error: String(data.error) };
  return { password: data?.password };
}
```

- [ ] **Step 4: Write the dialog**

`src/components/AdminConsole/GeneratedPasswordDialog.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Shows a generated password exactly once. The value lives only in the parent's
 * state for the life of this dialog — it is never persisted, never logged, and
 * never sent anywhere. Closing drops it for good.
 */
export function GeneratedPasswordDialog({
  password,
  onClose,
}: {
  password: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{t('admin.resetPassword')}</h3>
        <p className="py-2 text-sm opacity-70">{t('admin.passwordShownOnce')}</p>
        <p className="font-mono text-lg break-all bg-base-200 rounded-box p-3">{password}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={copy}>
            {copied ? t('admin.copied') : t('admin.copy')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('admin.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write the panel**

`src/components/AdminConsole/SocietyAccountsPanel.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  listSocietyAccounts,
  resetSocietyPassword,
  type SocietyAccountRow,
} from '../../api/societyAccounts';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';

export function SocietyAccountsPanel() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<SocietyAccountRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listSocietyAccounts().then(setAccounts);
  }, []);

  const reset = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(false);
    const res = await resetSocietyPassword(selected);
    if (res.password) setPassword(res.password);
    else setError(true);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {accounts.map((a) => (
        <button
          key={a.association_id}
          type="button"
          className={`btn btn-block justify-start ${
            selected === a.association_id ? 'btn-primary' : ''
          }`}
          onClick={() => setSelected(a.association_id)}
        >
          {a.association_name}
        </button>
      ))}

      <button
        type="button"
        className="btn btn-primary"
        disabled={!selected || busy}
        onClick={reset}
      >
        {t('admin.resetPassword')}
      </button>

      {error && (
        <p role="alert" className="alert alert-error text-sm">
          {t('admin.resetFailed')}
        </p>
      )}

      {password && (
        <GeneratedPasswordDialog password={password} onClose={() => setPassword(null)} />
      )}
    </div>
  );
}
```

Mount it in `AdminConsole.tsx` only when `adminRole === 'reis_admin'`.

- [ ] **Step 5: Add the strings**

`cs.json` under `admin`: `"accountsTab": "Účty"`, `"resetPassword": "Obnovit heslo"`,
`"passwordShownOnce": "Heslo se zobrazí jen jednou — zkopírujte ho hned."`,
`"copy": "Kopírovat"`, `"copied": "Zkopírováno"`,
`"resetFailed": "Nepodařilo se obnovit heslo"`.
`en.json` under `admin`: `"accountsTab": "Accounts"`,
`"resetPassword": "Reset password"`,
`"passwordShownOnce": "This password is shown once — copy it now."`,
`"copy": "Copy"`, `"copied": "Copied"`,
`"resetFailed": "Could not reset the password"`, `"close": "Close"`.
Add `"close": "Zavřít"` to `cs.json` too.

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/components/AdminConsole`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminConsole/ src/api/societyAccounts.ts src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(admin): reIS admin can reset any society's password"
```

---

### Task 7: Society self-service password change

**Files:**
- Create: `src/components/AdminConsole/ChangeMyPasswordForm.tsx`
- Modify: `src/store/slices/createAdminSlice.ts` (add `changeMyPassword`)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts`

**Interfaces:**
- Consumes: `adminAuthClient` session established by Task 2.
- Produces: `changeMyPassword(newPassword: string): Promise<{ error?: string }>` on the store.

This needs no Edge Function: *Secure password change* is OFF on the project, so a
logged-in user may change their own password with no re-authentication.

- [ ] **Step 1: Write the failing test**

```ts
it('changes the signed-in account password', async () => {
  updateUser.mockResolvedValueOnce({ data: {}, error: null });
  const state = makeState();

  const res = await state.changeMyPassword('NewPassword2345');

  expect(updateUser).toHaveBeenCalledWith({ password: 'NewPassword2345' });
  expect(res.error).toBeUndefined();
});

it('rejects a password shorter than 12 characters without calling Supabase', async () => {
  const state = makeState();
  const res = await state.changeMyPassword('short');

  expect(res.error).toBe('too_short');
  expect(updateUser).not.toHaveBeenCalled();
});
```

Add `const updateUser = vi.fn();` beside the other spies and
`updateUser: (...a: unknown[]) => updateUser(...a),` to the mocked `auth` object.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts -t 'password'`
Expected: FAIL — `changeMyPassword` is not a function.

- [ ] **Step 3: Write minimal implementation**

Add to the `AdminSlice` interface:

```ts
  /** Change the signed-in account's own password. Needs no admin rights. */
  changeMyPassword: (newPassword: string) => Promise<{ error?: string }>;
```

and to the slice body:

```ts
  changeMyPassword: async (newPassword) => {
    // 12 is above the project's Auth minimum on purpose: these are shared
    // society credentials that get passed between committee members.
    if (newPassword.length < 12) return { error: 'too_short' };
    const { error } = await adminAuthClient.auth.updateUser({ password: newPassword });
    if (error) {
      logError('Admin.changeMyPassword', error);
      return { error: 'change_failed' };
    }
    return {};
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the form**

`src/components/AdminConsole/ChangeMyPasswordForm.tsx`:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// No <form> native submission: the reIS app runs in a sandboxed iframe without
// `allow-forms`, so a real form submit is blocked. Trigger from onClick and
// support Enter via onKeyDown, exactly as SocietyLoginForm does.
export function ChangeMyPasswordForm() {
  const changeMyPassword = useAppStore((s) => s.changeMyPassword);
  const { t } = useTranslation();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error' | 'short'>('idle');
  const [busy, setBusy] = useState(false);

  const ready = next.length >= 12 && next === confirm;

  const submit = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setStatus('idle');
    const res = await changeMyPassword(next);
    if (!res.error) {
      setStatus('done');
      setNext('');
      setConfirm('');
    } else {
      setStatus(res.error === 'too_short' ? 'short' : 'error');
    }
    setBusy(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void submit();
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold">{t('admin.changeMyPassword')}</h3>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.newPassword')}</span>
        <input
          aria-label={t('admin.newPassword')}
          type="password"
          autoComplete="new-password"
          className="input input-bordered"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          onKeyDown={onKey}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.confirmPassword')}</span>
        <input
          aria-label={t('admin.confirmPassword')}
          type="password"
          autoComplete="new-password"
          className="input input-bordered"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={onKey}
        />
      </label>

      {status === 'short' && (
        <p role="alert" className="text-error text-sm">{t('admin.passwordTooShort')}</p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-error text-sm">{t('admin.passwordChangeFailed')}</p>
      )}
      {status === 'done' && (
        <p role="alert" className="text-success text-sm">{t('admin.passwordChanged')}</p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !ready}
        onClick={submit}
      >
        {t('admin.changeMyPassword')}
      </button>
    </div>
  );
}
```

Mount it in `AdminConsole.tsx` for every signed-in account, admin or not.

- [ ] **Step 6: Add the strings**

`cs.json`: `"changeMyPassword": "Změnit heslo"`, `"newPassword": "Nové heslo"`,
`"confirmPassword": "Potvrzení hesla"`,
`"passwordTooShort": "Heslo musí mít alespoň 12 znaků"`,
`"passwordChanged": "Heslo změněno"`,
`"passwordChangeFailed": "Nepodařilo se změnit heslo"`.
`en.json`: `"changeMyPassword": "Change password"`, `"newPassword": "New password"`,
`"confirmPassword": "Confirm password"`,
`"passwordTooShort": "Password must be at least 12 characters"`,
`"passwordChanged": "Password changed"`,
`"passwordChangeFailed": "Could not change the password"`.

- [ ] **Step 7: Run the full gate before pushing**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
```

Expected: all four pass. Gates run on CHANGED FILES — if an untouched-but-unclean
file is dragged in, fix it rather than reverting the change.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminConsole/ChangeMyPasswordForm.tsx src/store/slices/createAdminSlice.ts src/store/slices/__tests__/createAdminSlice.test.ts src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(admin): societies can change their own password"
```

---

## Post-implementation

1. Turn **Require current password when updating** ON in Auth → Sign In / Providers → Email. With a shared per-society credential, anyone holding a live session can otherwise change the password without knowing the current one and lock the society out.
2. Leave **Allow new users to sign up** OFF permanently.
3. Re-create the six societies through the new Accounts panel.
4. Point Auth **Site URL** at a working origin — `reismendelu.app` has an empty DNS zone, so every recovery and magic link currently dies there.
