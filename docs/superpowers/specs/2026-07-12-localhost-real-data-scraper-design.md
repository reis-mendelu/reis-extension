# Localhost real-data scraper — design

**Date:** 2026-07-12
**Goal:** Render the reIS iframe app at localhost with the developer's *real* (possibly stale) IS Mendelu data, by reusing the extension's own scraping code in Node to produce a `SyncedData` snapshot that the localhost app ingests through its production sync path.

**Success criterion (turnkey):** a fresh session does only —
1. `npm run scrape:real` once (populates the snapshot), then
2. `npm run dev` and open the app URL —
and the UI renders real data with **no flags to toggle and no debugging**.

---

## 1. Key insight

The extension's `src/api/*` layer (fetchers + the brittle HTML parsers) is environment-agnostic. It needs only four browser affordances, each replaceable in Node:

| Browser affordance | Where used | Node substitute |
|---|---|---|
| Session cookies (`fetch` `credentials:"include"`) | `src/api/client.ts` `fetchWithAuth` | `globalThis.fetch` shim that injects a `Cookie:` header captured from Playwright login |
| `DOMParser` (all parsers) | `src/api/**`, `src/utils/parsers/**` | **happy-dom** (existing devDep) |
| `IndexedDBService` (getUserParams cache + some sync writes/reads) | `src/services/storage` | **fake-indexeddb** (existing devDep), empty — so `getUserParams()` self-derives from IS |
| `isInIframe()` = `window.self !== window.parent` | `src/api/proxyClient.ts` | happy-dom top-level window ⇒ `false` ⇒ direct-fetch path |

Because the same `src/api/*` modules run in both the extension and the scraper, **the parsers are shared by construction** — there is no second copy to drift.

---

## 2. Components (all in `reis-extension`)

| # | Path | Responsibility |
|---|---|---|
| 1 | `scripts/scrape-real-data.ts` | CLI: Playwright login → capture cookies → install shims → run the orchestration → write snapshot. Thin. |
| 2 | `scripts/lib/nodeRuntime.ts` | Install the four Node shims (happy-dom globals, fake-indexeddb, cookie-injecting fetch). Isolated + unit-tested. |
| 3 | `scripts/lib/collectRealData.ts` | Standalone mirror of `syncAllData`'s fetch/assemble sequence (no `sendToIframe`, no Drive). Returns `SyncedData`. Reuses `src/api/*` unchanged. |
| 4 | `src/hooks/useAppLogic.ts` (edit) | Dev-only, standalone-only auto-ingest of the snapshot via a synthetic `REIS_SYNC_UPDATE`. |
| 5 | `package.json` (edit) | `scrape:real` script. |
| 6 | `.gitignore` (edit) | Ignore the snapshot (real personal data). |

---

## 3. Data flow (scraper)

```
.env creds ─▶ Playwright: POST /system/login.pl (credential_0/credential_1) ─▶ wait for auth
   │
   ▼  installNodeRuntime(cookies):
   │    happy-dom Window as globals (DOMParser, window; self===parent)
   │    fake-indexeddb as global indexedDB (empty)
   │    globalThis.fetch = (url, init) => nativeFetch(url, { ...init, headers: {...init.headers, Cookie } })
   ▼
collectRealData()  — mirror of syncAllData, calling src/api/* directly:
   getUserParams()                     // self-derives studium/obdobi from IS via fetchWithAuth
   Promise.allSettled([
     fetchFullSemesterSchedule(), fetchDualLanguageExams(),
     fetchDualLanguageSubjects(studium,obdobi), fetchDualLanguageStudyPlan(studium),
     fetchStudyStats(...), fetchStudyComparison(...),
     syncCvicneTests(studium), syncOdevzdavarny(studium,obdobi),
     fetchDualLanguagePastSubjects(),
   ])
   mergePastSubjects(...)
   per subject @ pLimit(3): fetchFilesFromFolder, fetchSyllabus, syncZaznamnik, classmates
   ⇒ assemble SyncedData  (typed import from src/types/messages — compile-time shape contract)
   ▼
write public/dev-real-data.json       // gitignored — real grades/names/classmates
```

Per-endpoint failures are tolerated exactly like production (`Promise.allSettled`); whatever succeeds is written. `collectRealData` deliberately omits `sendToIframe` and Drive backup — those are extension-runtime side effects, not data collection.

**Orchestration choice:** standalone mirror in `collectRealData.ts` (approved approach *a*), *not* a refactor of `syncService.ts`. The brittle parsers are already shared via `src/api/*`; the ~40-line orchestration sequence is duplicated intentionally to avoid any risk to the live periodic sync. Extracting a shared `collectSyncedData()` core from `syncService.ts` is a possible later cleanup, out of scope here.

---

## 4. Ingest wiring (localhost)

Edit the message effect in `useAppLogic.ts`. Auto-ingest is gated by **three** conditions, all required:

- `import.meta.env.DEV` — never in a production build.
- `!isInIframe()` — only the standalone localhost app; the real extension always runs inside an iframe on `is.mendelu.cz`, so it is never affected.
- `import.meta.env.VITE_USE_MOCK_DATA !== 'true'` — mock mode still wins when explicitly set.

When all hold, on mount:

```
const snap = await fetch('/dev-real-data.json').then(r => r.ok ? r.json() : null).catch(() => null);
if (snap) window.postMessage(Messages.syncUpdate({ ...snap, isSyncing: false }), '*');
```

In a top-level window `event.source === window === window.parent`, so the synthetic message passes the handler's existing `e.source !== window.parent` check and flows through the **exact production ingest code path** (store writes + IDB persistence). If the snapshot file is absent, the fetch 404s and it silently no-ops (empty app, same as today) — so nothing breaks before the first scrape.

**Safety:** the snapshot is gitignored, the `build:publicAssets` hook strips it from production output, and the loader is `import.meta.env.DEV`-gated — so it is packed only in dev builds and is dead code in production.

---

## 5. Turnkey UX

> **Approach change (verified during implementation):** `wxt dev` builds an
> *extension* and does not serve the app HTML over HTTP (`localhost:3000/main.html`
> 404s), so it can't be used to view the UI at a URL. Instead we run reIS as a
> **standalone Vite webapp** — no extension, no iframe. This is simpler and, being
> a normal localhost page, is directly openable/verifiable in a browser.

- **Components (added):** `dev/index.html`, `dev/main.web.tsx` (installs the shim, then boots `@/entrypoints/main/main`), `dev/chromeShim.ts` (minimal in-memory `chrome.storage` + `chrome.runtime.getURL` + no-op `identity`; merges into the partial `window.chrome` real Chrome exposes), `vite.web.config.ts` (root `dev/`, `publicDir` `public/`, `@`→`src`, port 3000). `@source "../src/**"` added to `src/index.css` so Tailwind scans components when the Vite root is `dev/`.
- **Flow:**
  1. `npm run scrape:real` (needs `.env` creds) → writes `public/dev-real-data.json`.
  2. `npm run dev:web` → serves the app at `http://localhost:3000`.
  3. On mount, standalone (`!isInIframe()`) + `import.meta.env.DEV` ⇒ `loadRealDataSnapshot()` fetches `/dev-real-data.json` (served from `public/`) and dispatches the synthetic `REIS_SYNC_UPDATE` (§4) → real data renders.
- **Verified:** with a real-shaped sample snapshot, the app renders at `localhost:3000` and the Exams view shows the snapshot's exams (ingest path exercised end-to-end).
- The `build:publicAssets` prod-strip hook still applies to the extension build; the webapp path doesn't ship at all.

---

## 6. Anti-drift guarantees (tests)

Three layers, all in the standard vitest suite (no creds/network needed):

1. **Single parser codebase (structural guard)** — `scripts/lib/__tests__/no-parser-reimpl.test.ts`: reads `scripts/lib/collectRealData.ts` (and sibling scraper libs) and asserts they contain **no** DOM-parsing primitives of their own (no `new DOMParser`, no ad-hoc `querySelector*` parsing) and that all data extraction is imported from `@/api/*` / `@/utils/parsers/*`. Fails CI if anyone reimplements a parser in the scraper.

2. **Parser behaviour pinned (shared contract / golden)** — real IS HTML fixtures → the shared parser → asserted structured output. Because the extension and the scraper call the identical module, one passing golden test covers both consumers simultaneously. Editing a parser forces updating this test *with a real IS sample* (per the repo's parser rules), and the scraper inherits the change automatically — it cannot diverge.

3. **Producer↔consumer shape pinned** — `src/hooks/__tests__/realDataIngest.test.ts`: feed a fixture `SyncedData` snapshot through the synthetic-`REIS_SYNC_UPDATE` ingest and assert the store slices populate (schedule/exams/subjects/…). Together with the compile-time `SyncedData` type shared by `collectRealData` and the handler, this pins that what the scraper writes is exactly what the localhost app reads.

---

## 7. Error handling

- **Login failure / missing creds:** clear message naming `.env` keys, exit non-zero. The tool never logs credential values.
- **Per-endpoint failures:** tolerated (`Promise.allSettled`); the snapshot is written with whatever succeeded. A `--verbose` flag surfaces per-call errors for debugging.
- **Auth expiry mid-run:** a 401/403 from `fetchWithAuth` would normally hit `window.location.href` — in Node happy-dom this is a harmless no-op/throw caught by allSettled; the run still writes partial data and logs the affected calls.

---

## 8. Privacy

- The snapshot holds real personal data (grades, names, classmates) — **gitignored**, never committed, never transmitted anywhere. It stays on the developer's machine.
- `.env` credentials are developer-supplied; the tool reads them via `dotenv` and never prints them. Claude never handles the credentials — the developer fills `.env`.

---

## 9. Out of scope (YAGNI)

- Refactoring `syncService.ts` to share a collection core (possible later cleanup).
- Any bidirectional or write-back path — read-only snapshot.
- Automated/scheduled scraping — manual, on-demand only.
- Firefox/other-target parity — the snapshot is target-agnostic; `npm run dev` (Chrome) is the documented path.
- Serving the snapshot from anywhere but the local dev server.
