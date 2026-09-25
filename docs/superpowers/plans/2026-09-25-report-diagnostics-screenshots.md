# Report attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A report from "Nahlásit chybu / Nápad" can carry a student-picked screenshot and, when the student ticks it, a cleaned log of the session's errors and warnings plus environment/sync flags.

**Architecture:** A dependency-free ring buffer in `src/utils/diagnostics/` is fed by `logError` and an explicitly installed console wrapper, in both the iframe app and the extension content script. The form collects, previews and prunes the payload and sends it with a re-encoded JPEG through a new `submit_suggestion_v2` RPC into a `suggestion_attachments` table with 90-day / on-done retention. The admin inbox shows badges and loads attachments on demand.

**Tech Stack:** React 19 + DaisyUI, Zustand, vitest + jsdom, Supabase (Postgres 15, PostgREST, pg_cron 1.6.4).

**Spec:** `docs/superpowers/specs/2026-09-25-report-diagnostics-screenshots-design.md`

## Global Constraints

- Buffer: 50 entries max; message first line only, ≤ 200 chars.
- Cleaning: URL query+fragment removed; emails → `‹email›`; decimals with ≥ 3 fraction digits → `‹n›`; runs of ≥ 5 digits → `‹#›`.
- `diagnosticLog.ts` imports nothing (content-script graph, #266).
- Screenshot: JPEG, longest side ≤ 1600 px, ≤ 614 400 bytes; server checks `\xffd8ff`.
- Diagnostics jsonb: array of ≤ 50 entries, ≤ 32 768 bytes as text.
- Global screenshot cap: 30 per rolling hour.
- Retention: 90 days, or immediately on `status = 'done'`.
- Checkbox **unchecked by default**; nothing attached unless the student acts.
- No install id, host URL, stack, `logError` `extra`, or IS page text in the payload.
- v1 `submit_suggestion` untouched.
- Every `revoke ... from public` is paired with `revoke ... from anon, authenticated` (the grant trap).
- Max ~200 lines per file; DaisyUI classes only; no localStorage.

---

### Task 1: Diagnostic log + cleaning

**Files:**
- Create: `src/utils/diagnostics/diagnosticLog.ts`
- Test: `src/utils/diagnostics/__tests__/diagnosticLog.test.ts`

**Interfaces — Produces:**
```ts
export type DiagnosticSource = 'app' | 'content';
export interface DiagnosticEntry { t: number; level: 'error' | 'warn'; source: DiagnosticSource; ctx: string | null; status?: number; msg: string }
export const DIAGNOSTIC_CAP = 50;
export function cleanMessage(raw: unknown): string;
export function setDiagnosticSource(s: DiagnosticSource): void;
export function recordDiagnostic(e: { level: 'error' | 'warn'; ctx: string | null; msg: unknown; status?: number }): void;
export function getDiagnostics(): DiagnosticEntry[];   // copy, oldest first
export function clearDiagnostics(): void;               // tests
```

- [ ] Tests: each cleaning rule (URL `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=123456;obdobi=789` → `https://is.mendelu.cz/auth/student/terminy_seznam.pl`; `a.b@mendelu.cz` → `‹email›`; `49.21025, 16.61503` → `‹n›, ‹n›`; `id 1234567` → `id ‹#›`; `HTTP 404` untouched; multi-line → first line; 500 chars → 200; Error objects use `.message`; non-strings stringified). Cap: 60 records → 50 kept, oldest dropped. Source stamped from `setDiagnosticSource`. `getDiagnostics()` returns a copy.
- [ ] Run → FAIL; implement; run → PASS.
- [ ] Commit `feat(diagnostics): in-memory log of cleaned errors and warnings`.

### Task 2: Feed from logError + console capture + graph guard

**Files:**
- Modify: `src/utils/reportError.ts` (record before `console.error`, mark call)
- Create: `src/utils/diagnostics/consoleCapture.ts`
- Modify: `src/entrypoints/main/main.tsx`, `src/entrypoints/content.ts`
- Test: `src/utils/diagnostics/__tests__/consoleCapture.test.ts`, extend `src/utils/__tests__/reportError*.test.ts` if present, and `scripts/lib/__tests__/contentScriptGraph.test.ts` (diagnosticLog has no imports)

**Interfaces — Produces:**
```ts
export function installConsoleCapture(source: DiagnosticSource, opts?: { onlyFilenamePrefix?: string }): void; // idempotent
```
`logError` sets a module flag `inLogError` around its `console.error`, exported as `isInsideLogError()` from `diagnosticLog.ts` via `markLogError(fn)` so the wrapper skips it.

- [ ] Tests: `logError('Api.fetchExams', Object.assign(new Error('boom ?x=1'), { status: 503 }))` records `{ctx:'Api.fetchExams', status:503, level:'error'}` once even with capture installed; `console.warn('w')` recorded as warn with `ctx:null`; `window.dispatchEvent(new ErrorEvent('error', {message:'m', filename:'https://is.mendelu.cz/x.js'}))` NOT recorded when `onlyFilenamePrefix:'chrome-extension://'`, recorded when filename starts with it; `unhandledrejection` recorded; installing twice doesn't double-record; original console still called.
- [ ] Implement; call `installConsoleCapture('app')` at top of `main.tsx` module body (next to `installExternalLinkHandler()`), and in `content.ts` `main()` first line: `setDiagnosticSource('content'); installConsoleCapture('content', { onlyFilenamePrefix: 'chrome-extension://' })`.
- [ ] Graph test: read `src/utils/diagnostics/diagnosticLog.ts`, assert no `import` statement.
- [ ] Commit `feat(diagnostics): capture logError and console warnings in app and content script`.

### Task 3: Content-script reply + collector

**Files:**
- Modify: `src/types/messages/base.ts` (`'get_diagnostics'` in `ActionType`), `src/types/messages/schema.ts` (allowlist), `src/injector/messageHandler.ts` (case returns `{ entries: getDiagnostics() }`)
- Create: `src/utils/diagnostics/collectDiagnostics.ts`
- Test: `src/utils/diagnostics/__tests__/collectDiagnostics.test.ts`, message schema test if one enumerates actions

**Interfaces — Produces:**
```ts
export interface DiagnosticsPayload { entries: DiagnosticEntry[]; env: {...}; sync: {...} } // exactly as spec
export async function collectDiagnostics(deps?: { fetchContent?: () => Promise<DiagnosticEntry[]>; now?: () => number }): Promise<DiagnosticsPayload>;
```
Merges app + content entries, sorted by `t`, last 50. `fetchContent` defaults to `executeAction('get_diagnostics')` raced against 1500 ms, only when `getPlatform().kind === 'extension'`, else `[]`. Env: platform from `getPlatform().kind` + `Capacitor.getPlatform()`-free UA parse (`iOS 26`, `Android 14`, `macOS`, `Windows`, `Linux`), `lang` from store `language`, `navigator.onLine`, `uptimeS` from `performance.now()`. Sync from `useAppStore.getState()`: `syncStatus.lastSync`, `isSyncing`, `schedule.status`, `exams.status`, lengths, `lastExamsFetchedAt`.

- [ ] Tests: merge/sort/cap; timeout fallback returns app entries only; non-extension never calls fetchContent; env/sync fields read from a seeded store; no field named `installId`/url in output (`JSON.stringify` check for `http`).
- [ ] Implement; commit `feat(diagnostics): collect app + content-script entries with env and sync flags`.

### Task 4: Screenshot re-encode

**Files:**
- Create: `src/utils/diagnostics/encodeScreenshot.ts`
- Test: `src/utils/diagnostics/__tests__/encodeScreenshot.test.ts`

**Interfaces — Produces:**
```ts
export const SCREENSHOT_MAX_BYTES = 614_400; export const SCREENSHOT_MAX_SIDE = 1600;
export function fitWithin(w: number, h: number, max: number): { w: number; h: number };
export async function encodeScreenshot(file: Blob, deps?: { decode?: (b: Blob) => Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }>; toJpeg?: (canvas: HTMLCanvasElement, q: number) => Promise<Blob> }): Promise<{ base64: string; bytes: number; previewUrl: string } | null>;
```
Quality steps 0.85, 0.75, 0.65, 0.5, 0.4; then scale 0.75 and retry; null if still too big or decode fails. Default decode uses `createImageBitmap`, fallback `<img>`.

- [ ] Tests: `fitWithin(4000,3000,1600)` → `1600x1200`; small images unchanged; quality loop stops at first fit; returns null when never fits; output base64 has no `data:` prefix.
- [ ] Implement; commit.

### Task 5: API v2 + types

**Files:**
- Modify: `src/types/suggestions.ts` (`SuggestionAttachmentsDraft`, `SubmitResult` gains `{ ok: true; screenshotDropped?: boolean }`, `SuggestionRow.suggestion_attachments?`), `src/api/suggestions.ts`
- Test: `src/api/__tests__/suggestions.test.ts`

**Interfaces — Produces:**
```ts
export interface SuggestionAttachmentsDraft { diagnostics?: DiagnosticsPayload | null; screenshotBase64?: string | null }
export async function submitSuggestion(draft: SuggestionDraft, attachments?: SuggestionAttachmentsDraft): Promise<SubmitResult>;
```
Calls `submit_suggestion_v2` with v1 params + `p_diagnostics`, `p_screenshot`. `'ok'` → `{ok:true}`; `'ok_without_screenshot'` → `{ok:true, screenshotDropped:true}` only if a screenshot was sent; `'rejected'` → `rate_limited`; error → `upstream`; throw → `offline`.
- [ ] Tests for each mapping and param names; no attachments → `p_diagnostics: null, p_screenshot: null`.
- [ ] Commit.

### Task 6: Form UI

**Files:**
- Create: `src/components/Feedback/ReportAttachments.tsx` (screenshot picker/paste/thumbnail + diagnostics checkbox/preview/per-line ✕), `src/components/Feedback/useReportAttachments.ts` (state + collect on open)
- Modify: `src/components/Feedback/FeedbackModal.tsx` (render block, pass to submit, desktop `max-h-[90dvh] overflow-y-auto`, toast when screenshot dropped), `src/i18n/locales/cs.json`, `en.json`
- Test: `src/components/Feedback/__tests__/ReportAttachments.test.tsx`, extend FeedbackModal test

- [ ] Tests: checkbox unchecked on open; unchecked → submit gets `diagnostics: null`; checked → gets entries minus removed ones; "Zobrazit (N)" shows count; screenshot ✕ clears; paste of image file sets screenshot; encode failure shows error text and sends none.
- [ ] Implement; commit.

### Task 7: Migration + local verification

**Files:**
- Create: `supabase/migrations/20260925120000_suggestion_attachments.sql`, `docs/verify-suggestion-attachments.md`

Table, generated columns, RLS/grants, `submit_suggestion_v2`, screenshot cap via `count(*) where has_screenshot and created_at > now()-1h`, 90-day prune, `done` trigger, `create extension if not exists pg_cron`, `cron.schedule('prune-suggestion-attachments','17 3 * * *', ...)` (unschedule first for idempotence).
- [ ] Verify on `supabase/postgres` docker (has pg_cron) with stubs for `suggestions`, `check_and_log_suggestion_bucket`, `get_my_role`: three results, JPEG check, size cap, malformed base64, cascade, done-trigger, anon cannot select/insert the table, anon cannot execute internals, cron job registered.
- [ ] Commit.

### Task 8: Admin inbox

**Files:**
- Modify: `src/api/suggestionsAdmin.ts` (embed counts; `getSuggestionAttachments(id)`), `src/utils/mock/devSuggestions.ts` (seed attachment for row 1), `src/components/AdminConsole/SuggestionsInbox.tsx`
- Create: `src/components/AdminConsole/SuggestionAttachments.tsx`, `src/utils/hexToBytes.ts` if needed
- Test: `src/components/AdminConsole/__tests__/SuggestionsInbox.test.tsx`, `src/api/__tests__/suggestionsAdmin.test.ts`

- [ ] Tests: badges from `suggestion_attachments`; attachments fetched only on click; bytea hex `\\xffd8…` → blob URL; diagnostics table rows.
- [ ] Implement; commit.

### Task 9: Privacy docs + guard + CLAUDE.md

**Files:** `PRIVACY.md`, `docs/privacy-policy-app.md`, `src/test/guards/noStudentDataLeaves.test.ts`, `CLAUDE.md`
- [ ] Guard: `submit_suggestion_v2` / `p_diagnostics` may appear only in `src/api/suggestions.ts`; `DiagnosticEntry` has no `stack` field (source check).
- [ ] Commit.

### Task 10: Verify, ship

- [ ] `npx vitest run src/utils/diagnostics src/api src/components/Feedback src/components/AdminConsole src/test/guards scripts/lib`; `npm run typecheck`.
- [ ] verify-ui: form (both trees, 320/390/430/tablet, both themes) and inbox; send PNGs.
- [ ] Apply migration to prod with `-f`; smoke via public API with publishable key; delete smoke rows.
- [ ] PR to `test`, Auto-fix on; drive CI green.
- [ ] Gist republish; App Store privacy label and Play Data safety via Chrome.
