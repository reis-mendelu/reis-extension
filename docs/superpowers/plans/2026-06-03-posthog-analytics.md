# PostHog Product Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit-event-only product analytics to the reIS iframe app via a hand-rolled PostHog `/batch` client, with no autocapture, no localStorage, no PII, and a combined opt-out.

**Architecture:** A single-call-site analytics module (`src/services/analytics/`) buffers typed events in memory and POSTs them to PostHog EU Cloud. Identity is an in-memory anon UUID that merges into a SHA-256 hash of the student ID once known. Content scripts (no PostHog access) forward events to the iframe over the existing postMessage bridge, mirroring the established `telemetryError` pattern. The combined opt-out reuses the existing `errorReportingEnabled` flag.

**Tech Stack:** TypeScript (strict), Vitest + happy-dom, WXT/manifest, React 19, Zustand.

**Spec:** `docs/superpowers/specs/2026-06-03-posthog-analytics-design.md`

**Conventions to honor (from CLAUDE.md):** no `localStorage`/`sessionStorage`; direct imports only; max 200 lines/file; state in Zustand; test-first; run `npm run build` after changes; one-line commit messages, no `Co-Authored-By`.

---

## Task 1: Config — env vars + manifest permissions

**Files:**
- Modify: `wxt.config.ts:22-32` (host_permissions), `wxt.config.ts:51-53` (CSP), `wxt.config.ts:41-46` (Firefox data_collection_permissions)
- Create: `.env.example` entry (and local `.env` if present)

- [ ] **Step 1: Add PostHog host permission**

In `wxt.config.ts`, add to the `host_permissions` array (after the supabase entry):

```ts
      'https://eu.i.posthog.com/*',
```

- [ ] **Step 2: Allow PostHog in CSP connect-src**

Replace the `content_security_policy` block:

```ts
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://*.supabase.co https://eu.i.posthog.com",
    },
```

(`connect-src` was previously absent, so it inherited `default-src`/`'self'`. Listing it explicitly preserves existing endpoints — supabase, plus the rest are covered by host_permissions — and adds PostHog. If any existing fetch breaks in `npm run dev`, widen this list rather than narrowing.)

- [ ] **Step 3: Declare data collection for Firefox AMO**

We now collect interaction data, so `required: ['none']` is no longer accurate. Replace:

```ts
        data_collection_permissions: {
          required: ['technicalAndInteraction'],
          optional: [],
        },
```

- [ ] **Step 4: Add env vars**

Add to `.env.example` (and `.env` if it exists locally):

```
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_POSTHOG_KEY=
```

Leave `VITE_POSTHOG_KEY` blank in `.env.example`; the real `phc_…` project ingestion key is filled in `.env` (public/write-only key — safe in the bundle). With the key blank, the client is a no-op (Task 2 guards on it), so the build stays green without secrets.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add wxt.config.ts .env.example
git commit -m "feat(analytics): posthog host permission, CSP, and env config"
```

---

## Task 2: Event taxonomy types + capture client

**Files:**
- Create: `src/services/analytics/events.ts`
- Create: `src/services/analytics/captureClient.ts`
- Test: `src/services/analytics/__tests__/captureClient.test.ts`

- [ ] **Step 1: Create the typed taxonomy**

`src/services/analytics/events.ts`:

```ts
// Explicit analytics taxonomy. Property value sets are fixed unions — never pass
// IS-derived strings (names, file names, grades). Course codes are public/allowed.
// See docs/superpowers/specs/2026-06-03-posthog-analytics-design.md §6.

export type FeatureKey =
    | 'calendar' | 'exams' | 'file_drawer' | 'drive_backup' | 'notes_editor'
    | 'iskam' | 'success_rate' | 'erasmus' | 'tutoring';

export type AnalyticsEvent =
    | { event: 'app_opened'; props: { host: 'is' | 'iskam'; cold_start: boolean; lang: string; theme: string; is_touch: boolean; is_narrow: boolean } }
    | { event: 'first_data_rendered'; props: { ms_since_open: number } }
    | { event: 'handshake_done'; props?: Record<string, never> }
    | { event: 'handshake_timed_out'; props?: Record<string, never> }
    | { event: 'feature_opened'; props: { feature: FeatureKey } }
    | { event: 'drive_backup_completed'; props: { files: number } }
    | { event: 'notes_card_created'; props?: Record<string, never> }
    | { event: 'file_opened'; props?: Record<string, never> }
    | { event: 'sync_failed'; props: { step: string } }
    | { event: 'empty_state_shown'; props: { feature: FeatureKey } };

export type EventName = AnalyticsEvent['event'];
```

- [ ] **Step 2: Write the failing test for captureClient**

`src/services/analytics/__tests__/captureClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postBatch, type CapturePayload } from '../captureClient';

const ev: CapturePayload = {
    event: 'app_opened',
    distinct_id: 'anon-1',
    properties: { host: 'is' },
    timestamp: '2026-06-03T00:00:00.000Z',
};

describe('postBatch', () => {
    beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })); });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('POSTs a PostHog batch envelope with api_key and per-event distinct_id', async () => {
        await postBatch([ev]);
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = (fetch as any).mock.calls[0];
        expect(url).toBe('https://eu.i.posthog.com/batch/');
        expect(init.method).toBe('POST');
        const body = JSON.parse(init.body);
        expect(body.api_key).toBe('phc_test');
        expect(body.batch[0].event).toBe('app_opened');
        expect(body.batch[0].properties.distinct_id).toBe('anon-1');
        expect(body.batch[0].properties.host).toBe('is');
        expect(body.batch[0].timestamp).toBe('2026-06-03T00:00:00.000Z');
    });

    it('is a no-op when the batch is empty', async () => {
        await postBatch([]);
        expect(fetch).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/analytics/__tests__/captureClient.test.ts`
Expected: FAIL — cannot find module `../captureClient`.

- [ ] **Step 4: Implement captureClient**

`src/services/analytics/captureClient.ts`:

```ts
// Pure transport to PostHog's /batch endpoint. No state, no buffering — the
// caller (analytics.ts) owns the queue. distinct_id rides inside properties,
// PostHog's canonical batch shape.

const HOST = (import.meta.env?.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';
const KEY = (import.meta.env?.VITE_POSTHOG_KEY as string | undefined) ?? '';

export interface CapturePayload {
    event: string;
    distinct_id: string;
    properties: Record<string, unknown>;
    timestamp: string;
}

function shouldSkipEnvironment(): boolean {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
    // Skip the WXT dev server but allow vitest (MODE === 'test') to exercise the path.
    if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') return true;
    return false;
}

export async function postBatch(events: CapturePayload[]): Promise<void> {
    if (events.length === 0) return;
    if (!KEY && import.meta.env?.MODE !== 'test') return; // no key configured → no-op
    if (shouldSkipEnvironment()) return;
    const api_key = KEY || 'phc_test';
    const batch = events.map((e) => ({
        event: e.event,
        timestamp: e.timestamp,
        properties: { distinct_id: e.distinct_id, $lib: 'reis-ext', ...e.properties },
    }));
    try {
        await fetch(`${HOST}/batch/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key, batch }),
            keepalive: true,
        });
    } catch { /* fire-and-forget — analytics must never throw into callers */ }
}
```

Note: the test asserts `api_key === 'phc_test'`; in `MODE === 'test'` with no key we fall through to `'phc_test'`. Keep that branch.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/analytics/__tests__/captureClient.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/services/analytics/events.ts src/services/analytics/captureClient.ts src/services/analytics/__tests__/captureClient.test.ts
git commit -m "feat(analytics): typed taxonomy and posthog batch client"
```

---

## Task 3: Analytics module — queue, flush, opt-out

**Files:**
- Create: `src/services/analytics/analytics.ts`
- Test: `src/services/analytics/__tests__/analytics.test.ts`

- [ ] **Step 1: Write the failing test**

`src/services/analytics/__tests__/analytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../captureClient', () => ({ postBatch: vi.fn().mockResolvedValue(undefined) }));
import { postBatch } from '../captureClient';
import { initAnalytics, track, flush } from '../analytics';

describe('analytics queue + opt-out', () => {
    beforeEach(() => { vi.clearAllMocks(); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('buffers events and flushes them in one batch', async () => {
        initAnalytics(() => true);
        track({ event: 'feature_opened', props: { feature: 'calendar' } });
        track({ event: 'file_opened' });
        await flush();
        expect(postBatch).toHaveBeenCalledTimes(1);
        const sent = (postBatch as any).mock.calls[0][0];
        expect(sent).toHaveLength(2);
        expect(sent[0].event).toBe('feature_opened');
        expect(sent[0].properties.feature).toBe('calendar');
        expect(sent[0].properties.extension_version).toBeDefined();
    });

    it('drops all events when opted out', async () => {
        initAnalytics(() => false);
        track({ event: 'file_opened' });
        await flush();
        expect(postBatch).not.toHaveBeenCalled();
    });

    it('attaches a stable distinct_id to every event', async () => {
        initAnalytics(() => true);
        track({ event: 'file_opened' });
        await flush();
        const sent = (postBatch as any).mock.calls[0][0];
        expect(typeof sent[0].distinct_id).toBe('string');
        expect(sent[0].distinct_id.length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/analytics/__tests__/analytics.test.ts`
Expected: FAIL — cannot find module `../analytics`.

- [ ] **Step 3: Implement analytics module**

`src/services/analytics/analytics.ts`:

```ts
// Single call site for product analytics. Buffers typed events in memory and
// flushes to PostHog. No localStorage/cookies — distinct_id is in-memory and
// derived fresh each load (see identify() in identity.ts, wired in Task 4).
// Opt-out reuses the combined errorReportingEnabled gate, checked on every track.

import { getBrowserInfo } from '../errorReporter/sanitize';
import { postBatch, type CapturePayload } from './captureClient';
import type { AnalyticsEvent } from './events';

const FLUSH_MS = 5000;

let queue: CapturePayload[] = [];
let getEnabled: () => boolean = () => false;
let timer: ReturnType<typeof setInterval> | null = null;
let openedAt = 0;

// Anonymous per-load id; replaced by the hashed student id via identify() (Task 4).
let distinctId = newAnonId();

function newAnonId(): string {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch { /* fall through */ }
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function getExtVersion(): string {
    try { return chrome?.runtime?.getManifest?.().version ?? '0.0.0'; } catch { return '0.0.0'; }
}

function commonProps(): Record<string, unknown> {
    const b = getBrowserInfo();
    return { extension_version: getExtVersion(), browser_name: b.name, browser_version: b.version };
}

// --- identity hooks used by identity.ts (Task 4) ---
export function _getDistinctId(): string { return distinctId; }
export function _setDistinctId(id: string): void { distinctId = id; }
export function _enqueueRaw(p: CapturePayload): void { queue.push(p); }
export function msSinceOpen(): number { return openedAt ? Math.round(performance.now() - openedAt) : 0; }

export function initAnalytics(enabled: () => boolean): void {
    getEnabled = enabled;
    queue = [];
    distinctId = newAnonId();
    openedAt = performance.now();
    if (timer) clearInterval(timer);
    if (typeof setInterval === 'function') {
        timer = setInterval(() => { void flush(); }, FLUSH_MS);
    }
}

export function track(e: AnalyticsEvent): void {
    if (!getEnabled()) return;
    queue.push({
        event: e.event,
        distinct_id: distinctId,
        properties: { ...commonProps(), ...('props' in e ? e.props : {}) },
        timestamp: new Date().toISOString(),
    });
}

export async function flush(): Promise<void> {
    if (!getEnabled()) { queue = []; return; }
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    await postBatch(batch);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/analytics/__tests__/analytics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/analytics/analytics.ts src/services/analytics/__tests__/analytics.test.ts
git commit -m "feat(analytics): in-memory queue, flush, and opt-out gate"
```

---

## Task 4: Identity — anon → hashed merge

**Files:**
- Create: `src/services/analytics/identity.ts`
- Test: `src/services/analytics/__tests__/identity.test.ts`

- [ ] **Step 1: Write the failing test**

`src/services/analytics/__tests__/identity.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../captureClient', () => ({ postBatch: vi.fn().mockResolvedValue(undefined) }));
import { postBatch } from '../captureClient';
import { initAnalytics, track, flush, _getDistinctId } from '../analytics';
import { identify } from '../identity';

describe('identify', () => {
    beforeEach(() => { vi.clearAllMocks(); initAnalytics(() => true); });

    it('emits a single $identify aliasing the prior anon id, then switches distinct_id', async () => {
        const anon = _getDistinctId();
        await identify('123456');
        const hashed = _getDistinctId();
        expect(hashed).not.toBe(anon);
        expect(hashed).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex

        track({ event: 'file_opened' });
        await flush();

        const sent = (postBatch as any).mock.calls.flatMap((c: any[]) => c[0]);
        const idEvents = sent.filter((e: any) => e.event === '$identify');
        expect(idEvents).toHaveLength(1);
        expect(idEvents[0].properties.$anon_distinct_id).toBe(anon);
        expect(idEvents[0].distinct_id).toBe(hashed);
        // subsequent normal event uses the hashed id
        expect(sent.find((e: any) => e.event === 'file_opened').distinct_id).toBe(hashed);
    });

    it('is idempotent — calling twice does not emit a second $identify', async () => {
        await identify('123456');
        await identify('123456');
        await flush();
        const sent = (postBatch as any).mock.calls.flatMap((c: any[]) => c[0]);
        expect(sent.filter((e: any) => e.event === '$identify')).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/analytics/__tests__/identity.test.ts`
Expected: FAIL — cannot find module `../identity`.

- [ ] **Step 3: Implement identity**

`src/services/analytics/identity.ts`:

```ts
// Merges the anonymous in-memory session into a pseudonymous person keyed by a
// SHA-256 hash of the student ID. Mirrors the hashing precedent in
// src/api/feedback.ts and the call timing in src/store/useAppStore.ts.

import { _getDistinctId, _setDistinctId, _enqueueRaw } from './analytics';

let identified = false;

async function hashId(raw: string): Promise<string> {
    const data = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function identify(studentId: string): Promise<void> {
    if (identified || !studentId) return;
    const anon = _getDistinctId();
    const hashed = await hashId(studentId);
    if (hashed === anon) return;
    identified = true;
    _setDistinctId(hashed);
    _enqueueRaw({
        event: '$identify',
        distinct_id: hashed,
        properties: { $anon_distinct_id: anon },
        timestamp: new Date().toISOString(),
    });
}

// Test-only reset; harmless in prod.
export function _resetIdentity(): void { identified = false; }
```

Note: `initAnalytics` resets `distinctId` but not this module's `identified` flag. Because each iframe load is a fresh module graph, `identified` starts `false` in production. In tests that need a clean slate, call `_resetIdentity()` in `beforeEach`. (The two tests above each run one `initAnalytics`; the idempotency test deliberately relies on persistence within the test.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/analytics/__tests__/identity.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/analytics/identity.ts src/services/analytics/__tests__/identity.test.ts
git commit -m "feat(analytics): anon-to-hashed identity merge"
```

---

## Task 5: Content-script → iframe event bridge

**Files:**
- Modify: `src/types/messages/base.ts:37-40`
- Modify: `src/types/messages.ts:7` (isContentMessage list) and the `Messages` factory

- [ ] **Step 1: Add the message type**

In `src/types/messages/base.ts`, after the `TelemetryErrorMessage` interface (line 37):

```ts
export interface TelemetryEventMessage { type: 'REIS_TELEMETRY_EVENT'; event: string; props?: Record<string, unknown>; }
```

Then add it to the `ContentToIframeMessage` union (line 40):

```ts
export type ContentToIframeMessage = DataResponseMessage | FetchResultMessage | ActionResultMessage | SyncUpdateMessage | PopupStateMessage | NavMenuMessage | IskamSyncUpdateMessage | IskamBlockResultMessage | TelemetryErrorMessage | TelemetryEventMessage;
```

- [ ] **Step 2: Register the type guard + factory**

In `src/types/messages.ts`, add `'REIS_TELEMETRY_EVENT'` to the array inside `isContentMessage` (line 7), and add this to the `Messages` object after `telemetryError`:

```ts
    telemetryEvent: (event: string, props?: Record<string, unknown>): T.TelemetryEventMessage => ({
        type: 'REIS_TELEMETRY_EVENT',
        event,
        props,
    }),
```

- [ ] **Step 3: Verify types**

Run: `npm run typecheck`
Expected: passes (the new union member is handled in Task 6's switch; until then `useAppLogic` ignores unknown content types via its final `return`, so typecheck is clean).

- [ ] **Step 4: Commit**

```bash
git add src/types/messages/base.ts src/types/messages.ts
git commit -m "feat(analytics): REIS_TELEMETRY_EVENT message type and factory"
```

---

## Task 6: Init analytics + lifecycle events in the iframe

**Files:**
- Modify: `src/entrypoints/main/main.tsx:19-20`
- Modify: `src/hooks/useAppLogic.ts` (message handler ~line 103; schedule-set branch ~line 116)

- [ ] **Step 1: Initialize analytics at iframe boot**

In `src/entrypoints/main/main.tsx`, after the `initTelemetry(...)` line (line 20), add:

```ts
import { initAnalytics, track } from '@/services/analytics/analytics'
// ...
initAnalytics(() => useAppStore.getState().errorReportingEnabled)
track({
  event: 'app_opened',
  props: {
    host: 'is',
    cold_start: !useAppStore.getState().schedule,
    lang: useAppStore.getState().language,
    theme: useAppStore.getState().theme,
    is_touch: useAppStore.getState().isTouch,
    is_narrow: useAppStore.getState().isNarrow,
  },
})
```

Before writing, confirm the exact store field names for language/theme/touch/narrow:
Run: `grep -nE "language:|theme:|isTouch|isNarrow" src/store/types.ts`
Use the confirmed names. If `isTouch`/`isNarrow` live under a viewport object, read them accordingly (e.g. `useAppStore.getState().isTouch`).

- [ ] **Step 2: Route bridged events into track()**

In `src/hooks/useAppLogic.ts`, in the `handle` message callback, right after the existing `REIS_TELEMETRY_ERROR` block (lines 103-106), add:

```ts
            if (d.type === 'REIS_TELEMETRY_EVENT') {
                track({ event: d.event, props: d.props } as Parameters<typeof track>[0]);
                return;
            }
```

Add the import at the top of the file:

```ts
import { track, msSinceOpen } from '../services/analytics/analytics';
```

- [ ] **Step 3: Fire first_data_rendered on the first schedule paint**

In `src/hooks/useAppLogic.ts`, in the schedule branch (`if (r.schedule) { useAppStore.getState().setSchedule(...) }`, ~line 116), guard a once-only emit. Add a ref near the other refs at the top of the hook:

```ts
    const firstPaintSent = useRef(false);
```

Then inside the `if (r.schedule)` block, after `setSchedule`:

```ts
                if (!firstPaintSent.current) {
                    firstPaintSent.current = true;
                    track({ event: 'first_data_rendered', props: { ms_since_open: msSinceOpen() } });
                }
```

- [ ] **Step 4: Fire handshake events**

Find where `handshakeDone` / `handshakeTimedOut` are set:
Run: `grep -rn "handshakeDone\|handshakeTimedOut" src/store/slices/createSyncSlice.ts`
In each setter, add the matching `track({ event: 'handshake_done' })` / `track({ event: 'handshake_timed_out' })` immediately after the `set(...)`. Import `track` from `../../services/analytics/analytics` in that slice.

- [ ] **Step 5: Verify build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/entrypoints/main/main.tsx src/hooks/useAppLogic.ts src/store/slices/createSyncSlice.ts
git commit -m "feat(analytics): init + lifecycle events (app_opened, first_data_rendered, handshake)"
```

---

## Task 7: Wire identify on the daily-usage path

**Files:**
- Modify: `src/store/useAppStore.ts:124-128`

- [ ] **Step 1: Call identify alongside trackDailyUsage**

In `src/store/useAppStore.ts`, the existing block resolves `getUserParams()` and calls `trackDailyUsage(p.studentId)`. Extend it to also identify:

```ts
    // Fire-and-forget daily usage tracking + analytics identity
    import('../api/feedback').then(({ trackDailyUsage }) =>
        import('../utils/userParams').then(({ getUserParams }) =>
            getUserParams().then(p => {
                if (!p) return;
                trackDailyUsage(p.studentId);
                import('../services/analytics/identity').then(({ identify }) => identify(p.studentId));
            })
        )
    );
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat(analytics): identify hashed student id on daily-usage path"
```

---

## Task 8: feature_opened + empty_state_shown instrumentation

Goal: one `track({ event: 'feature_opened', props: { feature } })` when each feature surface first mounts, and `empty_state_shown` where features render their empty state. A tiny mount hook keeps call sites to one line.

**Files:**
- Create: `src/hooks/useTrackFeatureOpen.ts`
- Test: `src/hooks/__tests__/useTrackFeatureOpen.test.tsx`
- Modify (one line each): the top-level component of each feature surface (see Step 4)

- [ ] **Step 1: Write the failing test**

`src/hooks/__tests__/useTrackFeatureOpen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../services/analytics/analytics', () => ({ track: vi.fn() }));
import { track } from '../../services/analytics/analytics';
import { useTrackFeatureOpen } from '../useTrackFeatureOpen';

describe('useTrackFeatureOpen', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('fires feature_opened exactly once on mount', () => {
        const { rerender } = renderHook(() => useTrackFeatureOpen('exams'));
        rerender();
        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith({ event: 'feature_opened', props: { feature: 'exams' } });
    });
});
```

(If the repo uses `@testing-library/react`'s `renderHook` differently, mirror an existing hook test — run `ls src/hooks/__tests__` and copy its import style.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useTrackFeatureOpen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

`src/hooks/useTrackFeatureOpen.ts`:

```ts
import { useEffect, useRef } from 'react';
import { track } from '../services/analytics/analytics';
import type { FeatureKey } from '../services/analytics/events';

// Fires feature_opened once per mount. Place at the top of each feature surface.
export function useTrackFeatureOpen(feature: FeatureKey): void {
    const sent = useRef(false);
    useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        track({ event: 'feature_opened', props: { feature } });
    }, [feature]);
}
```

- [ ] **Step 4: Add one call per feature surface**

Confirm each surface's top-level component, then add `useTrackFeatureOpen('<key>')` as the first hook in its body. Discover exact files:

Run: `ls src/components/Exams src/components/ExamPanel src/components/WeeklyCalendar src/components/SubjectFileDrawer src/components/ErasmusPanel src/components/IskamPanel src/components/SuccessRate src/components/StudyJams`

Map (use the panel/root component in each dir):
- `calendar` → `src/components/WeeklyCalendar` root
- `exams` → `src/components/ExamPanel` root
- `file_drawer` → `src/components/SubjectFileDrawer` root
- `erasmus` → `src/components/ErasmusPanel` root
- `iskam` → `src/components/IskamPanel` root
- `success_rate` → `src/components/SuccessRate` root (or `SuccessRateTab.tsx`)
- `tutoring` → `src/components/StudyJams` root
- `drive_backup` → `src/components/SubjectFileDrawer/Header/DriveBackupStatus.tsx` (fire on connect, not mount — see Task 9)
- `notes_editor` → notes editor root (discover: `grep -rln "card-first\|notesDoc\|NoteEditor\|cards" src/components`)

For each, add (example for ExamPanel root):

```tsx
import { useTrackFeatureOpen } from '@/hooks/useTrackFeatureOpen';
// ...inside the component body, first line:
  useTrackFeatureOpen('exams');
```

- [ ] **Step 5: Add empty_state_shown where features render empty states**

Discover existing empty-state markers:
Run: `grep -rln "empty\|EmptyState\|žádn\|no .* found" src/components/Exams src/components/WeeklyCalendar src/components/SubjectFileDrawer`
In each confirmed empty-render branch's component, add a mount-guarded emit using the same `useRef` pattern:

```tsx
  const emptySent = useRef(false);
  useEffect(() => {
    if (isEmpty && !emptySent.current) { emptySent.current = true; track({ event: 'empty_state_shown', props: { feature: 'exams' } }); }
  }, [isEmpty]);
```

(Use the real local that indicates emptiness in that component; do not invent `isEmpty` if a different flag exists.)

- [ ] **Step 6: Run hook test + build**

Run: `npx vitest run src/hooks/__tests__/useTrackFeatureOpen.test.tsx && npm run build`
Expected: PASS + build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useTrackFeatureOpen.ts src/hooks/__tests__/useTrackFeatureOpen.test.tsx src/components
git commit -m "feat(analytics): feature_opened and empty_state_shown instrumentation"
```

---

## Task 9: Action + content-script events

Covers `notes_card_created`, `file_opened`, `drive_backup_completed`, `sync_failed`.

**Files (discover exact handlers first — commands given per event):**
- Modify: notes card-create handler; file-open handler; `src/services/drive/driveBackup.ts`; `src/injector/syncService.ts`

- [ ] **Step 1: notes_card_created**

Find the create handler:
Run: `grep -rnE "cards:\s*\[|addCard|createCard|\.cards\b" src/services/notes src/store/slices src/components | grep -i card | head`
At the confirmed create action (the function that appends a new card), add:

```ts
import { track } from '@/services/analytics/analytics';
// after the card is created:
track({ event: 'notes_card_created' });
```

- [ ] **Step 2: file_opened**

Find where a subject file is opened/fetched for viewing:
Run: `grep -rnE "openFile|fetchBlock|REIS_FETCH|onClick.*file|setActiveFile|previewFile" src/components/SubjectFileDrawer src/store/slices | head`
At the confirmed open handler (iframe side), add `track({ event: 'file_opened' });`.

- [ ] **Step 3: drive_backup_completed (content script → bridge)**

In `src/services/drive/driveBackup.ts`, find where a run finishes successfully (search for where last-success is recorded):
Run: `grep -nE "success|complete|manifest|lastSuccess|setLastSuccess" src/services/drive/driveBackup.ts | head`
At the success point, emit via the bridge (content-script context has no PostHog). Use the same `sendToIframe(Messages.telemetryError(...))` channel already imported in that area; add:

```ts
import { sendToIframe } from '@/injector/iframeManager';
import { Messages } from '@/types/messages';
// at successful completion, with the uploaded file count in scope:
sendToIframe(Messages.telemetryEvent('drive_backup_completed', { files: uploadedCount }));
```

Confirm the real variable holding the count (search the function); if backup runs report a diff/summary object, read the count from it. Do not invent `uploadedCount` if a different field exists.

- [ ] **Step 4: sync_failed (content script → bridge)**

In `src/injector/syncService.ts`, the catch sites already call `sendToIframe(Messages.telemetryError('Sync.…', e))`. Alongside (not replacing) the telemetryError call at the top-level sync failure catch, add:

```ts
sendToIframe(Messages.telemetryEvent('sync_failed', { step: 'syncAllData' }));
```

Use a `step` label matching the specific catch (e.g. `'syncClassmates'`, `'fetchSeminarGroupIds'`) so friction can be localized. Keep `step` values to short fixed identifiers — never interpolate error text.

- [ ] **Step 5: Verify build + full test run**

Run: `npm run build && npm run test:run`
Expected: build succeeds; tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/services src/injector src/store src/components
git commit -m "feat(analytics): action and content-script events"
```

---

## Task 10: Combined opt-out label + PRIVACY.md

**Files:**
- Modify: `src/components/Sidebar/ProfilePopup.tsx` (~line 135 toggle)
- Modify: `src/components/MobileNav/MobileProfileSheet.tsx` (~line 152 toggle)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Modify: `PRIVACY.md`

- [ ] **Step 1: Relabel the toggle to combined wording**

Both toggles bind to `errorReportingEnabled`. Update the visible label/description string keys to "Usage analytics & diagnostics" (EN) / a faithful CZ translation, conveying it covers anonymous usage analytics and error diagnostics, opt-out, no personal data.

Find the current i18n keys:
Run: `grep -rn "errorReporting\|error_reporting\|diagnostic" src/i18n/locales/en.json src/components/Sidebar/ProfilePopup.tsx`
Update the EN value to e.g. `"Usage analytics & diagnostics"` with a sub-label like `"Anonymous usage and error data to improve reIS. No personal data, schedules, or grades."`, and the CZ equivalent. Do not rename the keys (avoids touching both components again) unless the key name is shown to users.

- [ ] **Step 2: Update PRIVACY.md**

- Expand §3 ("Anonymous Usage Analytics") to describe: behavioral product analytics via PostHog (EU Cloud, `eu.i.posthog.com`); explicit events only (no autocapture/recording); pseudonymous identity = SHA-256 hash of student ID (irreversible, also used for daily-active); no IS content, names, grades, or file names ever sent.
- Add **PostHog** (`eu.i.posthog.com`, EU) to §"Third-Party Access" list (item 5).
- Under §"User Control", state the combined "Usage analytics & diagnostics" opt-out (same toggle as error reporting) and that it disables both.
- Bump "Last Updated" to 2026-06-03.

- [ ] **Step 3: Verify build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar/ProfilePopup.tsx src/components/MobileNav/MobileProfileSheet.tsx src/i18n/locales/cs.json src/i18n/locales/en.json PRIVACY.md
git commit -m "feat(analytics): combined opt-out label and privacy disclosure"
```

---

## Task 11: Final verification

- [ ] **Step 1: Full gate**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`
Expected: all green.

- [ ] **Step 2: Manual smoke (optional, requires real key in `.env`)**

With a real `VITE_POSTHOG_KEY` set, `npm run dev`, load IS Mendelu, open features, and confirm in PostHog → Activity that `app_opened`, `first_data_rendered`, and `feature_opened` arrive with hashed `distinct_id` and **no** PII in properties. Toggle the opt-out off and confirm events stop.

- [ ] **Step 3: Coverage sanity for the analytics module**

Run: `npx vitest run src/services/analytics`
Expected: all analytics tests pass.

---

## Spec coverage check

- §3 approach (hand-rolled client) → Tasks 2-3
- §4 architecture/bridge → Tasks 2,3,5,6
- §5 identity (anon→hashed, IDB opt-out, no localStorage) → Tasks 3,4,7,10
- §6 taxonomy (all 10 event kinds) → Tasks 2 (types), 6 (app_opened/first_data_rendered/handshake), 8 (feature_opened/empty_state_shown), 9 (notes_card_created/file_opened/drive_backup_completed/sync_failed)
- §7 config/hosting/permissions → Task 1
- §8 combined opt-out + PRIVACY.md → Tasks 3 (gate), 10
- §9 testing (TDD) → Tasks 2,3,4,8 + Task 11
- §10 out-of-scope (flags, recording, autocapture) → never introduced

## Out of scope (deferred follow-ups)

- ISKAM-side analytics beyond what shares the iframe module — the ISKAM app has a separate store/iframe; wiring `app_opened {host:'iskam'}` + an ISKAM bridge mirrors Tasks 5-6 and is a separate small plan.
- Server-side ingestion, PostHog feature flags, session recording, heatmaps.
