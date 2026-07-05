# Society Authoring in the Extension — Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student-society contact log into reIS by handle+password (via a hidden trigger) and author "society posts" that write to the unified `spolky_events` table under RLS.

**Architecture:** A separate Supabase auth client persists the session in `chrome.storage.local`; a new Zustand `AdminSlice` holds session/role/association and drives a login overlay opened by triple-clicking the student-ID badge; a `societyPosts` API performs RLS-gated writes with the authenticated client. The bell feed and engagement tracking are repointed off the retired `notifications` table onto `spolky_events`/`increment_post_*`. The presentational UI is a minimal functional shell — deliberately un-polished, to be redesigned in the follow-up UI spec.

**Tech Stack:** React 19, Zustand (+ `StateCreator` slice pattern), `@supabase/supabase-js`, Tailwind 4 + DaisyUI 5, Vitest + happy-dom, WXT.

## Global Constraints

- **Depends on Plan 1 being applied** (the `spolky_events` post columns, `increment_post_view/click` RPCs, retired `notifications`, and hardened RLS must exist).
- **TDD**: failing test first, then minimal implementation (repo Iron Rule "test first").
- **NO `localStorage`/`sessionStorage`** — session persists in `chrome.storage.local` (Iron Rule).
- **Direct imports only** (no barrels); **max 200 lines/file**; **DaisyUI classes only** (no custom CSS).
- **The admin auth client is separate** from the anon `supabase` client in `src/services/spolky/supabaseClient.ts`; student reads must never carry an admin JWT.
- **All writes go through `adminAuthClient`** (carries the JWT); authorization is enforced server-side by RLS + `get_my_role()`. The hidden trigger is not a security boundary.
- **react-hooks 7**: no render-time ref access — only touch refs inside callbacks/effects (per prior CI failure).
- **Before any push**: changed-files `eslint --max-warnings=0`, `npm run typecheck`, `npm run test:run`, and `npm run build` (exit 0).

**Reference — verified existing shapes:**
- `AppSlice<T> = StateCreator<AppState, [], [], T>` (`src/store/types.ts:444`). `AppState` is an `&`-intersection ending `… & import('./slices/createRsvpSlice').RsvpSlice;` (`types.ts:441`).
- Slice pattern: `export const createXSlice: AppSlice<XSlice> = (set, get) => ({...})`; composed in `useAppStore.ts` via `...createXSlice(...a)`; slice tests call `createXSlice(set, get, {} as any)` (see `createRsvpSlice.test.ts`).
- Anon client: `export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` (`src/services/spolky/supabaseClient.ts`), constants in `src/services/supabase/config.ts`.
- `chrome.storage.local` usage precedent: `src/services/drive/driveManifest.ts`.
- `spolkyService.ts`: `trackNotificationsViewed` → `increment_notification_view`; `trackNotificationClick` → `increment_notification_click`; `fetchNotifications` reads `notifications`.
- Student-ID badge `<span class="… select-all …">{params.studentId}</span>`: `ProfilePopup.tsx:52`, `MobileProfileSheet.tsx:79`.
- Overlays mount in `src/components/AppOverlays.tsx` (a fragment of modals reading store flags).

---

### Task 1: `chrome.storage.local` session adapter

**Files:**
- Create: `src/services/admin/chromeStorageAdapter.ts`
- Test: `src/services/admin/__tests__/chromeStorageAdapter.test.ts`

**Interfaces:**
- Produces: `chromeStorageAdapter: { getItem(k):Promise<string|null>; setItem(k,v):Promise<void>; removeItem(k):Promise<void> }` — consumed by `authClient` (Task 3).

- [ ] **Step 1: Write the failing test**
```ts
// src/services/admin/__tests__/chromeStorageAdapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { chromeStorageAdapter } from '../chromeStorageAdapter';

describe('chromeStorageAdapter', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      storage: { local: {
        get: async (k: string) => ({ [k]: store[k] }),
        set: async (obj: Record<string, unknown>) => { Object.assign(store, obj); },
        remove: async (k: string) => { delete store[k]; },
      } },
    };
  });

  it('round-trips a value', async () => {
    await chromeStorageAdapter.setItem('reis_admin_auth', 'tok');
    expect(await chromeStorageAdapter.getItem('reis_admin_auth')).toBe('tok');
  });

  it('returns null for a missing key', async () => {
    expect(await chromeStorageAdapter.getItem('nope')).toBeNull();
  });

  it('removes a value', async () => {
    await chromeStorageAdapter.setItem('k', 'v');
    await chromeStorageAdapter.removeItem('k');
    expect(await chromeStorageAdapter.getItem('k')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/services/admin/__tests__/chromeStorageAdapter.test.ts`
Expected: FAIL — cannot resolve `../chromeStorageAdapter`.

- [ ] **Step 3: Write minimal implementation**
```ts
// src/services/admin/chromeStorageAdapter.ts
/**
 * supabase-js session storage backed by chrome.storage.local (iframe-accessible,
 * survives reloads). Replaces the default localStorage store, which the project
 * bans (Iron Rule). supabase-js awaits these, so async is fine.
 */
export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const res = await chrome.storage.local.get(key);
    return (res[key] as string | undefined) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/services/admin/__tests__/chromeStorageAdapter.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add src/services/admin/chromeStorageAdapter.ts src/services/admin/__tests__/chromeStorageAdapter.test.ts
git commit -m "feat(admin): chrome.storage.local session adapter for supabase auth"
```

---

### Task 2: Handle→email mapping

**Files:**
- Create: `src/services/admin/societyLogin.ts`
- Test: `src/services/admin/__tests__/societyLogin.test.ts`

**Interfaces:**
- Produces: `SOCIETY_EMAIL_DOMAIN = 'societies.reis.invalid'`; `handleToEmail(handle: string): string` — consumed by `AdminSlice.adminLogin` (Task 3).

- [ ] **Step 1: Write the failing test**
```ts
// src/services/admin/__tests__/societyLogin.test.ts
import { describe, it, expect } from 'vitest';
import { handleToEmail } from '../societyLogin';

describe('handleToEmail', () => {
  it('maps a handle to the synthetic society email', () => {
    expect(handleToEmail('supef')).toBe('supef@societies.reis.invalid');
  });
  it('lowercases and trims', () => {
    expect(handleToEmail('  ESN ')).toBe('esn@societies.reis.invalid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/services/admin/__tests__/societyLogin.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/services/admin/societyLogin.ts
/**
 * Society accounts log in by handle (== association_id, e.g. "supef"). Supabase
 * Auth keys on email, so we map the handle to a fixed synthetic address that
 * never receives mail (RFC 2606 `.invalid`). The society never sees this string.
 */
export const SOCIETY_EMAIL_DOMAIN = 'societies.reis.invalid';

export function handleToEmail(handle: string): string {
  return `${handle.trim().toLowerCase()}@${SOCIETY_EMAIL_DOMAIN}`;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/services/admin/__tests__/societyLogin.test.ts` — Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add src/services/admin/societyLogin.ts src/services/admin/__tests__/societyLogin.test.ts
git commit -m "feat(admin): handle->synthetic-email mapping for society login"
```

---

### Task 3: Admin auth client + `AdminSlice`

**Files:**
- Create: `src/services/admin/authClient.ts`
- Create: `src/store/slices/createAdminSlice.ts`
- Modify: `src/store/types.ts:441` (append `AdminSlice` to `AppState`)
- Modify: `src/store/useAppStore.ts` (import + spread + `loadAdminSession()` in init)
- Test: `src/store/slices/__tests__/createAdminSlice.test.ts`

**Interfaces:**
- Consumes: `chromeStorageAdapter` (Task 1), `handleToEmail` (Task 2).
- Produces: `adminAuthClient` (a `SupabaseClient`); `AdminSlice { adminSession, adminRole, adminAssociationId, adminOverlayOpen, openAdminOverlay(), closeAdminOverlay(), adminLogin(handle,password)→{error?}, adminLogout(), loadAdminSession() }` — consumed by the trigger (Task 6), overlay (Task 7), and `societyPosts` uses `adminAuthClient` (Task 4).

- [ ] **Step 1: Write the failing test** (mock the auth client so no network)
```ts
// src/store/slices/__tests__/createAdminSlice.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signIn = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn();
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: { signInWithPassword: (...a: unknown[]) => signIn(...a), getSession: () => getSession(), signOut: () => signOut() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
  },
}));

import { createAdminSlice, type AdminSlice } from '../createAdminSlice';

describe('createAdminSlice', () => {
  let state: AdminSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    signIn.mockReset(); getSession.mockReset(); maybeSingle.mockReset();
    set = vi.fn((u) => { state = { ...state, ...(typeof u === 'function' ? u(state) : u) }; });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createAdminSlice(set, get, {} as any);
  });

  it('starts logged out with overlay closed', () => {
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminOverlayOpen).toBe(false);
  });

  it('opens and closes the overlay', () => {
    state.openAdminOverlay();  expect(state.adminOverlayOpen).toBe(true);
    state.closeAdminOverlay(); expect(state.adminOverlayOpen).toBe(false);
  });

  it('login success sets session, role and association', async () => {
    signIn.mockResolvedValue({ data: { session: { user: { email: 'supef@societies.reis.invalid' } } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'supef' } });
    const res = await state.adminLogin('supef', 'pw');
    expect(res.error).toBeUndefined();
    expect(state.adminRole).toBe('association');
    expect(state.adminAssociationId).toBe('supef');
    expect(state.adminSession).not.toBeNull();
  });

  it('login failure returns an error and stays logged out', async () => {
    signIn.mockResolvedValue({ data: { session: null }, error: { message: 'bad' } });
    const res = await state.adminLogin('supef', 'wrong');
    expect(res.error).toBeDefined();
    expect(state.adminSession).toBeNull();
  });

  it('logout clears everything', async () => {
    signIn.mockResolvedValue({ data: { session: { user: { email: 'x@societies.reis.invalid' } } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.adminLogin('esn', 'pw');
    await state.adminLogout();
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminAssociationId).toBeNull();
  });

  it('loadAdminSession hydrates from a persisted session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'esn@societies.reis.invalid' } } } });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.loadAdminSession();
    expect(state.adminAssociationId).toBe('esn');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts` — Expected: FAIL (`createAdminSlice`/`authClient` missing).

- [ ] **Step 3a: Write the auth client**
```ts
// src/services/admin/authClient.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { chromeStorageAdapter } from './chromeStorageAdapter';

/**
 * Supabase client that HOLDS the society/admin auth session. Kept separate from
 * the anon `supabase` client (reads/telemetry) so student reads never carry an
 * admin JWT. Session persists in chrome.storage.local — never localStorage.
 */
export const adminAuthClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    storageKey: 'reis_admin_auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3b: Write the slice**
```ts
// src/store/slices/createAdminSlice.ts
import type { Session } from '@supabase/supabase-js';
import type { AppSlice } from '../types';
import { adminAuthClient } from '../../services/admin/authClient';
import { handleToEmail } from '../../services/admin/societyLogin';
import { logError } from '../../utils/reportError';

export type AdminRole = 'association' | 'reis_admin';

export interface AdminSlice {
  adminSession: Session | null;
  adminRole: AdminRole | null;
  adminAssociationId: string | null;
  adminOverlayOpen: boolean;
  openAdminOverlay: () => void;
  closeAdminOverlay: () => void;
  adminLogin: (handle: string, password: string) => Promise<{ error?: string }>;
  adminLogout: () => Promise<void>;
  loadAdminSession: () => Promise<void>;
}

async function resolveAccount(email: string): Promise<{ role: AdminRole | null; associationId: string | null }> {
  const { data } = await adminAuthClient
    .from('spolky_accounts')
    .select('role, association_id')
    .eq('email', email)
    .maybeSingle();
  return { role: (data?.role as AdminRole) ?? null, associationId: data?.association_id ?? null };
}

// The society/admin auth session. Separate from IS-Mendelu data; hydrated at
// startup from chrome.storage via loadAdminSession(). isAssociation/role gate the
// UI only — every write is RLS-gated server-side.
export const createAdminSlice: AppSlice<AdminSlice> = (set) => ({
  adminSession: null,
  adminRole: null,
  adminAssociationId: null,
  adminOverlayOpen: false,
  openAdminOverlay: () => set({ adminOverlayOpen: true }),
  closeAdminOverlay: () => set({ adminOverlayOpen: false }),
  adminLogin: async (handle, password) => {
    const email = handleToEmail(handle);
    const { data, error } = await adminAuthClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: 'invalid_credentials' };
    const { role, associationId } = await resolveAccount(email);
    set({ adminSession: data.session, adminRole: role, adminAssociationId: associationId });
    return {};
  },
  adminLogout: async () => {
    try { await adminAuthClient.auth.signOut(); } catch (e) { logError('Admin.logout', e); }
    set({ adminSession: null, adminRole: null, adminAssociationId: null, adminOverlayOpen: false });
  },
  loadAdminSession: async () => {
    const { data } = await adminAuthClient.auth.getSession();
    if (!data.session) return;
    const email = data.session.user.email ?? '';
    const { role, associationId } = await resolveAccount(email);
    set({ adminSession: data.session, adminRole: role, adminAssociationId: associationId });
  },
});
```

- [ ] **Step 3c: Register the slice**
In `src/store/types.ts:441`, append to the `AppState` intersection: `& import('./slices/createAdminSlice').AdminSlice`.
In `src/store/useAppStore.ts`: add `import { createAdminSlice } from './slices/createAdminSlice';` and, inside the `create<AppState>()` object (after `...createRsvpSlice(...a),`), add `...createAdminSlice(...a),`. In `initializeStore`, in the Tier-1 block (after `s.loadContext();`, ~line 100), add `s.loadAdminSession();`.

- [ ] **Step 4: Run test + typecheck**
Run: `npx vitest run src/store/slices/__tests__/createAdminSlice.test.ts` — Expected: PASS (6 tests).
Run: `npm run typecheck` — Expected: exit 0 (AppState now includes AdminSlice).

- [ ] **Step 5: Commit**
```bash
git add src/services/admin/authClient.ts src/store/slices/createAdminSlice.ts \
        src/store/slices/__tests__/createAdminSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(admin): admin auth client + AdminSlice (login/logout/session hydration)"
```

---

### Task 4: Society-post write API

**Files:**
- Create: `src/api/societyPosts.ts`
- Test: `src/api/__tests__/societyPosts.test.ts`

**Interfaces:**
- Consumes: `adminAuthClient` (Task 3).
- Produces: `PostInput`, `createPost(input, associationId, createdBy)→{id?,error?}`, `updatePost(id, patch)→{error?}`, `deletePost(id)→{error?}`, `listMyPosts(associationId)→SpolkyEventRow[]`. Consumed by the overlay (Task 7).

- [ ] **Step 1: Write the failing test**
```ts
// src/api/__tests__/societyPosts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertSingle = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single: () => insertSingle() }) }));
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { from: () => ({ insert }) },
}));

import { toRow, createPost, type PostInput } from '../societyPosts';

const base: PostInput = {
  title: 'Party', body: 'come', category: 'party', date: '2026-07-10',
  venueKind: 'campus', roomCode: 'Q01',
};

describe('societyPosts.toRow', () => {
  it('maps camelCase input to snake_case row with association + created_by', () => {
    const row = toRow(base, 'supef', 'supef@societies.reis.invalid');
    expect(row).toMatchObject({
      association_id: 'supef', created_by: 'supef@societies.reis.invalid',
      title: 'Party', body: 'come', category: 'party', date: '2026-07-10',
      venue_kind: 'campus', room_code: 'Q01',
      end_date: null, time: null, coord_lng: null, coord_lat: null, location: null, url: null, visible_from: null,
    });
  });
});

describe('societyPosts.createPost', () => {
  beforeEach(() => { insert.mockClear(); insertSingle.mockReset(); });
  it('returns the new id on success', async () => {
    insertSingle.mockResolvedValue({ data: { id: 'abc' }, error: null });
    const res = await createPost(base, 'supef', 'supef@societies.reis.invalid');
    expect(res.id).toBe('abc');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ association_id: 'supef', venue_kind: 'campus' }));
  });
  it('returns an error on failure', async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const res = await createPost(base, 'supef', 'x');
    expect(res.error).toBe('denied');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/api/__tests__/societyPosts.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/api/societyPosts.ts
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';

export type VenueKind = 'campus' | 'online' | 'offcampus';

export interface PostInput {
  title: string;
  body: string;
  category: string;            // EventCategory value
  date: string;                // YYYY-MM-DD
  endDate?: string | null;
  time?: string | null;
  venueKind: VenueKind;
  roomCode?: string | null;
  coordLng?: number | null;
  coordLat?: number | null;
  location?: string | null;
  url?: string | null;
  visibleFrom?: string | null;
}

export interface SpolkyEventRow {
  id: string;
  association_id: string;
  title: string;
  body: string | null;
  category: string;
  date: string;
  end_date: string | null;
  time: string | null;
  venue_kind: string;
  room_code: string | null;
  coord_lng: number | null;
  coord_lat: number | null;
  location: string | null;
  url: string | null;
}

// Pure camelCase → snake_case mapping, unit-testable without the network.
export function toRow(input: PostInput, associationId: string, createdBy: string) {
  return {
    association_id: associationId,
    created_by: createdBy,
    title: input.title,
    body: input.body,
    category: input.category,
    date: input.date,
    end_date: input.endDate ?? null,
    time: input.time ?? null,
    venue_kind: input.venueKind,
    room_code: input.roomCode ?? null,
    coord_lng: input.coordLng ?? null,
    coord_lat: input.coordLat ?? null,
    location: input.location ?? null,
    url: input.url ?? null,
    visible_from: input.visibleFrom ?? null,
  };
}

export async function createPost(input: PostInput, associationId: string, createdBy: string): Promise<{ id?: string; error?: string }> {
  const { data, error } = await adminAuthClient
    .from('spolky_events').insert(toRow(input, associationId, createdBy)).select('id').single();
  if (error) { logError('Admin.createPost', error); return { error: error.message }; }
  return { id: (data as { id: string }).id };
}

export async function updatePost(id: string, patch: Partial<ReturnType<typeof toRow>>): Promise<{ error?: string }> {
  const { error } = await adminAuthClient.from('spolky_events').update(patch).eq('id', id);
  if (error) { logError('Admin.updatePost', error); return { error: error.message }; }
  return {};
}

export async function deletePost(id: string): Promise<{ error?: string }> {
  const { error } = await adminAuthClient.from('spolky_events').delete().eq('id', id);
  if (error) { logError('Admin.deletePost', error); return { error: error.message }; }
  return {};
}

export async function listMyPosts(associationId: string): Promise<SpolkyEventRow[]> {
  const { data, error } = await adminAuthClient
    .from('spolky_events').select('*').eq('association_id', associationId).order('date', { ascending: true });
  if (error) { logError('Admin.listMyPosts', error); return []; }
  return (data ?? []) as SpolkyEventRow[];
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/api/__tests__/societyPosts.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add src/api/societyPosts.ts src/api/__tests__/societyPosts.test.ts
git commit -m "feat(admin): RLS-gated societyPosts write API on spolky_events"
```

---

### Task 5: Repoint the feed + engagement tracking off `notifications`

**Files:**
- Modify: `src/services/spolky/spolkyService.ts`
- Test: `src/services/spolky/__tests__/spolkyService.repoint.test.ts`

**Interfaces:** unchanged public signatures (`trackNotificationsViewed`, `trackNotificationClick`, `fetchNotifications`); only the table/RPC targets change to `spolky_events` / `increment_post_*`.

- [ ] **Step 1: Write the failing test** (asserts the new RPC names + table)
```ts
// src/services/spolky/__tests__/spolkyService.repoint.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn(async () => ({ data: null, error: null }));
const from = vi.fn();
vi.mock('../supabaseClient', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

import { trackNotificationsViewed, trackNotificationClick } from '../spolkyService';

describe('engagement tracking repoint', () => {
  beforeEach(() => rpc.mockClear());
  it('view tracking calls increment_post_view', async () => {
    await trackNotificationsViewed(['id1']);
    expect(rpc).toHaveBeenCalledWith('increment_post_view', { row_id: 'id1' });
  });
  it('click tracking calls increment_post_click', async () => {
    await trackNotificationClick('id2');
    expect(rpc).toHaveBeenCalledWith('increment_post_click', { row_id: 'id2' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/services/spolky/__tests__/spolkyService.repoint.test.ts` — Expected: FAIL (still calls `increment_notification_*`).

- [ ] **Step 3: Edit `spolkyService.ts`**
- Line 21: `supabase.rpc('increment_notification_view', { row_id: id })` → `supabase.rpc('increment_post_view', { row_id: id })`.
- Line 36: `supabase.rpc('increment_notification_click', { row_id: notificationId })` → `supabase.rpc('increment_post_click', { row_id: notificationId })`.
- In `fetchNotifications` (lines 45–83): change `.from('notifications')` → `.from('spolky_events')`; replace the `.gt('expires_at', …)` active-filter with an upcoming filter `.gte('date', new Date().toISOString().slice(0, 10))`; keep the `visible_from` `.or(...)`; change `.order('created_at', …)` → `.order('date', { ascending: true })`. Update the `SupabaseNotification` interface + map to source from `spolky_events` columns:
```ts
    return (data || []).map((n: SupabaseNotification) => ({
      id: n.id,
      associationId: n.association_id,
      title: n.title,
      body: n.body || n.title,
      link: n.url || undefined,
      createdAt: n.created_at,
      expiresAt: n.end_date || n.date,   // events use their date as natural expiry
      priority: 'normal' as const,
    }));
```
where `SupabaseNotification` becomes `{ id; association_id; title; body: string|null; url: string|null; created_at: string; date: string; end_date: string|null }`.

- [ ] **Step 4: Run test + typecheck**
Run: `npx vitest run src/services/spolky/__tests__/spolkyService.repoint.test.ts` — Expected: PASS (2 tests).
Run: `npm run typecheck` — Expected: exit 0.

- [ ] **Step 5: Commit**
```bash
git add src/services/spolky/spolkyService.ts src/services/spolky/__tests__/spolkyService.repoint.test.ts
git commit -m "refactor(spolky): repoint feed + tracking from notifications to spolky_events"
```

---

### Task 6: Hidden trigger on the student-ID badge

**Files:**
- Create: `src/hooks/ui/useTripleClick.ts`
- Test: `src/hooks/ui/__tests__/useTripleClick.test.ts`
- Modify: `src/components/Sidebar/ProfilePopup.tsx`
- Modify: `src/components/MobileNav/MobileProfileSheet.tsx`

**Interfaces:**
- Produces: `useTripleClick(onTriple: () => void, windowMs?: number): () => void` — a click handler that fires after 3 clicks within the window.

- [ ] **Step 1: Write the failing test**
```ts
// src/hooks/ui/__tests__/useTripleClick.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTripleClick } from '../useTripleClick';

describe('useTripleClick', () => {
  it('fires after three clicks in the window', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useTripleClick(cb, 600));
    result.current(); result.current(); expect(cb).not.toHaveBeenCalled();
    result.current(); expect(cb).toHaveBeenCalledTimes(1);
  });
  it('does not fire on two clicks', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useTripleClick(cb, 600));
    result.current(); result.current();
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/hooks/ui/__tests__/useTripleClick.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Write the hook** (ref touched only inside the callback — react-hooks 7 safe)
```ts
// src/hooks/ui/useTripleClick.ts
import { useRef } from 'react';

/** Returns an onClick handler that invokes `onTriple` after 3 clicks/taps within
 *  `windowMs`. Works for mouse and touch (triple-tap). */
export function useTripleClick(onTriple: () => void, windowMs = 600): () => void {
  const clicks = useRef<number[]>([]);
  return () => {
    const now = Date.now();
    clicks.current = clicks.current.filter((t) => now - t < windowMs);
    clicks.current.push(now);
    if (clicks.current.length >= 3) {
      clicks.current = [];
      onTriple();
    }
  };
}
```

- [ ] **Step 4: Wire the badge in both components.**
In `ProfilePopup.tsx`: add imports `import { useTripleClick } from '../../hooks/ui/useTripleClick';`; inside the component body add `const openAdminOverlay = useAppStore(s => s.openAdminOverlay);` and `const onBadge = useTripleClick(openAdminOverlay);`. On the studentId `<span>` (line 52), add `onClick={onBadge}` and `title=""` (no visible hint). Do the identical wiring in `MobileProfileSheet.tsx` (badge at line 79), importing from `'../../hooks/ui/useTripleClick'` and `useAppStore` (already imported there).

- [ ] **Step 5: Run tests + typecheck**
Run: `npx vitest run src/hooks/ui/__tests__/useTripleClick.test.ts` — Expected: PASS (2 tests).
Run: `npm run typecheck` — Expected: exit 0.

- [ ] **Step 6: Commit**
```bash
git add src/hooks/ui/useTripleClick.ts src/hooks/ui/__tests__/useTripleClick.test.ts \
        src/components/Sidebar/ProfilePopup.tsx src/components/MobileNav/MobileProfileSheet.tsx
git commit -m "feat(admin): triple-click student-ID badge opens the society admin overlay"
```

---

### Task 7: Functional shell overlay (login + authoring) — visuals deferred

**Files:**
- Create: `src/components/SocietyAdmin/SocietyAdminOverlay.tsx`
- Create: `src/components/SocietyAdmin/SocietyLoginForm.tsx`
- Create: `src/components/SocietyAdmin/SocietyPostManager.tsx`
- Modify: `src/components/AppOverlays.tsx` (mount `<SocietyAdminOverlay />`)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (add an `admin` block)
- Test: `src/components/SocietyAdmin/__tests__/SocietyAdminOverlay.test.tsx`

**Interfaces:**
- Consumes: `AdminSlice` (Task 3), `societyPosts` API (Task 4).
- Note: this is an intentionally minimal DaisyUI shell so the flow is testable end-to-end. The native, seamless UI is the follow-up UI spec — keep each file well under 200 lines.

- [ ] **Step 1: Write the failing test** (overlay shows login when open + logged out)
```tsx
// src/components/SocietyAdmin/__tests__/SocietyAdminOverlay.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SocietyAdminOverlay } from '../SocietyAdminOverlay';

describe('SocietyAdminOverlay', () => {
  beforeEach(() => {
    useAppStore.setState({ adminOverlayOpen: false, adminSession: null, adminRole: null, adminAssociationId: null });
  });
  it('renders nothing when closed', () => {
    const { container } = render(<SocietyAdminOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the login form when open and logged out', () => {
    useAppStore.setState({ adminOverlayOpen: true });
    render(<SocietyAdminOverlay />);
    expect(screen.getByLabelText(/handle/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/SocietyAdmin/__tests__/SocietyAdminOverlay.test.tsx` — Expected: FAIL (components missing).

- [ ] **Step 3a: `SocietyLoginForm.tsx`**
```tsx
// src/components/SocietyAdmin/SocietyLoginForm.tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function SocietyLoginForm() {
  const adminLogin = useAppStore((s) => s.adminLogin);
  const { t } = useTranslation();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(false);
    const res = await adminLogin(handle, password);
    setBusy(false);
    if (res.error) setError(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.handle')}</span>
        <input aria-label={t('admin.handle')} className="input input-bordered" value={handle}
               onChange={(e) => setHandle(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.password')}</span>
        <input aria-label={t('admin.password')} type="password" className="input input-bordered"
               value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="text-error text-sm">{t('admin.loginError')}</p>}
      <button className="btn btn-primary" disabled={busy || !handle || !password}>{t('admin.login')}</button>
    </form>
  );
}
```

- [ ] **Step 3b: `SocietyPostManager.tsx`** (minimal list + create; delete). Reads `adminAssociationId`, uses `listMyPosts`/`createPost`/`deletePost`. Keep under 200 lines; a bare form (title, body, category `<select>` over the 10 categories, date, `venue_kind` `<select>`, conditional room_code/coord/url) and a list of the association's posts with a delete button. Load posts with a local `useState` + an async loader called on mount **via an event handler / effect that only orchestrates state** (data fetching stays in the API module, per the Iron Rules). Example skeleton:
```tsx
// src/components/SocietyAdmin/SocietyPostManager.tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, deletePost, listMyPosts, type PostInput, type SpolkyEventRow } from '../../api/societyPosts';

const CATEGORIES = ['party','boardgames','trip','quiz','sports','film','karaoke','culture','social','other'] as const;

export function SocietyPostManager() {
  const associationId = useAppStore((s) => s.adminAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const { t } = useTranslation();
  const [posts, setPosts] = useState<SpolkyEventRow[]>([]);
  const [form, setForm] = useState<PostInput>({ title: '', body: '', category: 'party', date: '', venueKind: 'campus', roomCode: '' });

  const reload = () => { if (associationId) listMyPosts(associationId).then(setPosts); };
  useEffect(reload, [associationId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!associationId) return;
    const res = await createPost(form, associationId, email);
    if (!res.error) { setForm({ title: '', body: '', category: 'party', date: '', venueKind: 'campus', roomCode: '' }); reload(); }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-2">
        <input className="input input-bordered" placeholder={t('admin.title')} value={form.title}
               onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="textarea textarea-bordered" placeholder={t('admin.body')} value={form.body}
               onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <select className="select select-bordered" value={form.category}
               onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="input input-bordered" value={form.date}
               onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <select className="select select-bordered" value={form.venueKind}
               onChange={(e) => setForm({ ...form, venueKind: e.target.value as PostInput['venueKind'] })}>
          <option value="campus">campus</option><option value="offcampus">offcampus</option><option value="online">online</option>
        </select>
        {form.venueKind === 'campus' && (
          <input className="input input-bordered" placeholder={t('admin.roomCode')} value={form.roomCode ?? ''}
                 onChange={(e) => setForm({ ...form, roomCode: e.target.value })} />
        )}
        <button className="btn btn-primary btn-sm">{t('admin.addPost')}</button>
      </form>
      <ul className="flex flex-col gap-1">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{p.date} · {p.title}</span>
            <button className="btn btn-ghost btn-xs text-error" onClick={() => deletePost(p.id).then(reload)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
> Note: this uses `useEffect` only to orchestrate local UI state from the API module (the Iron Rule bans `useEffect` for *fetching in components* — the fetch itself lives in `societyPosts.ts`). If the reviewer prefers zero `useEffect`, trigger `reload()` from an overlay-open handler instead.

- [ ] **Step 3c: `SocietyAdminOverlay.tsx`**
```tsx
// src/components/SocietyAdmin/SocietyAdminOverlay.tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { SocietyLoginForm } from './SocietyLoginForm';
import { SocietyPostManager } from './SocietyPostManager';

export function SocietyAdminOverlay() {
  const open = useAppStore((s) => s.adminOverlayOpen);
  const close = useAppStore((s) => s.closeAdminOverlay);
  const logout = useAppStore((s) => s.adminLogout);
  const session = useAppStore((s) => s.adminSession);
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">{t('admin.title_panel')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={close}>✕</button>
        </div>
        {session ? <SocietyPostManager /> : <SocietyLoginForm />}
        {session && <button className="btn btn-ghost btn-sm mt-4" onClick={logout}>{t('admin.logout')}</button>}
      </div>
      <div className="modal-backdrop" onClick={close} />
    </div>
  );
}
```

- [ ] **Step 3d: Mount + i18n.**
In `src/components/AppOverlays.tsx`, add `import { SocietyAdminOverlay } from './SocietyAdmin/SocietyAdminOverlay';` and render `<SocietyAdminOverlay />` inside the returned fragment.
Add an `"admin"` block to `src/i18n/locales/cs.json` and `en.json` with keys: `handle, password, login, loginError, title_panel, title, body, roomCode, addPost, logout`. EN example:
```json
"admin": { "handle": "Society handle", "password": "Password", "login": "Log in", "loginError": "Invalid handle or password", "title_panel": "Society posts", "title": "Title", "body": "Description", "roomCode": "Room code", "addPost": "Add post", "logout": "Log out" }
```
CZ example:
```json
"admin": { "handle": "Zkratka spolku", "password": "Heslo", "login": "Přihlásit", "loginError": "Neplatná zkratka nebo heslo", "title_panel": "Příspěvky spolku", "title": "Název", "body": "Popis", "roomCode": "Místnost", "addPost": "Přidat příspěvek", "logout": "Odhlásit" }
```

- [ ] **Step 4: Run test + typecheck**
Run: `npx vitest run src/components/SocietyAdmin/__tests__/SocietyAdminOverlay.test.tsx` — Expected: PASS (2 tests).
Run: `npm run typecheck` — Expected: exit 0.

- [ ] **Step 5: Commit**
```bash
git add src/components/SocietyAdmin/ src/components/AppOverlays.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(admin): functional society login + post-authoring shell overlay"
```

---

### Task 8: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Typecheck.** Run: `npm run typecheck` — Expected: exit 0.
- [ ] **Step 2: Lint changed files (CI gate).** Run: `npx eslint --max-warnings=0 src/services/admin src/store/slices/createAdminSlice.ts src/api/societyPosts.ts src/services/spolky/spolkyService.ts src/hooks/ui/useTripleClick.ts src/components/SocietyAdmin src/components/Sidebar/ProfilePopup.tsx src/components/MobileNav/MobileProfileSheet.tsx` — Expected: 0 errors, 0 warnings.
- [ ] **Step 3: Full unit run.** Run: `npm run test:run` — Expected: all green (new suites + no regressions, incl. `mapEvents`).
- [ ] **Step 4: Build.** Run: `npm run build` — Expected: exit 0.
- [ ] **Step 5: Manual smoke (with a real society account created in the dashboard).** Load the extension, triple-click the student-ID badge → overlay opens → log in with a society handle+password → create a `campus` post with a room → confirm the row appears via `listMyPosts` and on the campus map (`fetchMapEvents`). Confirm a wrong password shows the error and no session persists.

---

## Self-review

- **Spec coverage (Track B):** chrome.storage adapter → Task 1; handle→email → Task 2; admin auth client + slice (login/logout/hydrate, overlay flag) → Task 3; write API → Task 4; feed + tracking repoint → Task 5; hidden trigger on the badge → Task 6; functional login/authoring shell + i18n + mount → Task 7; verification gate → Task 8. **All Plan-2 spec items mapped.**
- **Deferred (correctly):** native authoring UI/UX (follow-up UI spec); map click-to-pick editing, analytics/errors/accounts/study-jams, society-catalog unification (future increments). The shell in Task 7 is explicitly minimal.
- **Type consistency:** `adminAuthClient` name consistent across Tasks 3–4; `AdminSlice` fields (`adminSession/adminRole/adminAssociationId/adminOverlayOpen/openAdminOverlay/closeAdminOverlay/adminLogin/adminLogout/loadAdminSession`) match between the slice, the test, the trigger (Task 6 uses `openAdminOverlay`), and the overlay (Task 7 uses `adminOverlayOpen/closeAdminOverlay/adminLogout/adminSession`). `PostInput`/`toRow`/`SpolkyEventRow` consistent between Task 4 and Task 7. `increment_post_view/click` match Plan 1 Task 2.
- **Placeholder scan:** no TBD/TODO; every unit has full code + a real test; the one reviewer-discretion note (Task 7 `useEffect` vs open-handler) is a documented style choice with both paths specified, not a gap.
- **Iron-rule checks:** no `localStorage` (chrome.storage adapter); direct imports only; DaisyUI classes only; files kept under 200 lines; admin client separate from anon client; writes RLS-gated via `adminAuthClient`.
```
