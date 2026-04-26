# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

reIS (REIS.mendelu) is a Chrome browser extension that simplifies the MENDELU university Information System (IS Mendelu) for students. Built with WXT, it injects an iframe containing a React app into IS Mendelu pages. All processing is client-side — no student data is intercepted or stored externally.

## Commands

```bash
npm run dev              # WXT dev server
npm run build            # Production build
npm run build:watch      # Watch-mode rebuild
npm run zip              # Create deployable .zip

npm run test             # Vitest watch mode
npm run test:run         # Single test run
npm run test:coverage    # Coverage report (V8)
npm run test:e2e         # Playwright E2E (headless)
npm run test:e2e:headed  # E2E with visible browser

npm run lint             # ESLint
npm run typecheck        # TypeScript strict check
```

Run a single test file: `npx vitest run src/store/slices/__tests__/someSlice.test.ts`

## Architecture

### Extension Structure (WXT)
- **Content script** (`src/entrypoints/content.ts`) — injects an iframe into IS Mendelu pages
- **Iframe app** (`src/entrypoints/main/`) — React 19 app rendered inside the iframe
- **Injector** (`src/injector/`) — DOM manipulation, iframe lifecycle, postMessage IPC between content script and app
- Manifest is generated from `wxt.config.ts` (never hand-edited)

### State & Storage (3-Tier)
1. **Zustand** (in-memory, reactive) — all UI reads go through `useAppStore` synchronously
2. **IndexedDB** via `IndexedDBService` — persistent heavy data, survives reloads
3. **Chrome Sync** — small user settings that follow across devices

Store uses the **slice pattern**: `src/store/slices/create*Slice.ts` composed into `useAppStore.ts`.

### Data Flow
- `src/api/` — stateless fetch functions (network only)
- `src/services/sync/` — background sync orchestrator (IS Mendelu → IndexedDB → Zustand)
- Components read from store synchronously; background sync is the only authorized writer to persistent state

### Dual-Language (CZ/EN)
- Language-sensitive data stored as `{ cz: Data, en: Data }`
- Sync services fetch both languages in parallel for instant switching
- Internal code uses `'cs'`/`'en'`; IS Mendelu API uses `'cz'`/`'en'` — mapping applied in API layer
- UI strings via `useTranslation()` hook reading from `src/i18n/locales/{cs,en}.json`

## Host Integration Contract

The extension uses a **push-based postMessage IPC** for each injected host. There are exactly two execution contexts: the **content script** (runs on the host page, has auth cookies) and the **iframe app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse.

### IS Mendelu (`is.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/content.ts` | Registers `handleMessage`, calls `startInjection()` |
| Iframe injection + queue | `injector/iframeManager.ts` | `injectIframe()`, `markIframeReady()`, `sendToIframe()` |
| Data fetching | `injector/syncService.ts` | `startSyncService()` → `syncAllData()` → `sendToIframe(REIS_SYNC_UPDATE)` |
| Message routing | `injector/messageHandler.ts` | Handles `REIS_READY` → flush queue; handles actions/fetch/data |
| Iframe bootstrap | `entrypoints/main/main.tsx` → `hooks/useAppLogic.ts` | IDB hydration → signal `REIS_READY` → listen for `REIS_SYNC_UPDATE` |
| Skeleton guard | `store/slices/createSyncSlice.ts` | `handshakeDone` / `handshakeTimedOut` (10s) unblock skeletons |

### WebISKAM (`webiskam.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/webiskam.content.ts` | `document.open/write/close`, registers `handleIskamMessage`, calls `startIskamSync()` |
| Iframe injection + queue | `injector/iskamInjector.ts` | `startIskamInjection()`, `markIskamIframeReady()`, `sendToIskamIframe()` |
| Data fetching | `injector/iskamSyncService.ts` | `startIskamSync()` → `syncIskamData()` → `sendToIskamIframe(ISKAM_SYNC_UPDATE)` |
| Message routing | `injector/iskamMessageHandler.ts` | Handles `ISKAM_READY` → flush queue + send current state |
| Iframe bootstrap | `entrypoints/iskam/IskamApp.tsx` | IDB hydration → signal `ISKAM_READY` → listen for `ISKAM_SYNC_UPDATE` |
| Skeleton guard | `store/iskamStore.ts` | `handshakeDone` / `handshakeTimedOut` (10s) unblock skeletons |

### Isolation rules
- `useIskamStore` is separate from `useAppStore`. They share only theme/language (via `loadTheme`/`loadLanguage`).
- `IskamMessages` factory is separate from `Messages` factory. ISKAM message types begin with `ISKAM_`.
- The ISKAM iframe never calls the WebISKAM API directly. Only the content script calls `fetchDualLanguageIskam()`.
- IDB writes for ISKAM data happen in the iframe (`IskamApp.tsx`), not in the content script — mirrors IS Mendelu pattern.
- Adding a new host: create `injector/<host>Injector.ts`, `injector/<host>SyncService.ts`, `injector/<host>MessageHandler.ts`, message types (`ISKAM_*` → `<HOST>_*`), and iframe bootstrap logic.

## Parser Rules

IS Mendelu HTML parsers (`src/api/documents/parser.ts`, `src/api/ukoly.ts`, `src/api/osnovy.ts`, `src/utils/parsers/`) are **extremely brittle** and must almost never be altered.

- **Never modify a parser to fix a lint or vitest error.** If a lint rule flags parser code, suppress the rule with a comment. If a vitest test fails because the parser was changed, revert the parser and fix the test fixture instead.
- When a test fixture uses a headerless table (`<table>` with no `<thead>`), add proper headers to the fixture — do not relax the parser guard to accept headerless tables.
- Any parser change requires a real IS Mendelu HTML sample as evidence that the change is correct. Without it, revert.
- Column index constants in parsers are load-bearing — a one-off change silently breaks production data.

## Iron Rules (from `.agent/rules/charlie-munger.md`)

These are enforced by linting and project convention:

- **NO `localStorage`/`sessionStorage`** — use `IndexedDBService`
- **NO proxy/re-export files** — import directly from implementation files
- **NO `useEffect` for data fetching** — fetch in services/store, not components
- **NO custom CSS** — use DaisyUI semantic classes (`btn-primary`, `bg-base-200`)
- **NO generic state** — all state lives in Zustand slices
- **Max 200 lines per file** — split if larger
- **Direct imports only** — no middleman re-export barrels; import from the specific file
- **Test first** — write a failing test before implementation

## Tech Stack

- **Framework**: WXT (Web Extension Toolkit)
- **UI**: React 19 + Tailwind CSS 4 + DaisyUI 5
- **State**: Zustand (sliced) + Immer
- **Storage**: IndexedDB (`idb`) + Chrome Storage API
- **Testing**: Vitest + happy-dom (unit), Playwright (E2E)
- **Language**: TypeScript (strict mode)
- **Path alias**: `@/*` → `src/*`

## Key Directories

| Path | Purpose |
|------|---------|
| `src/entrypoints/` | WXT entry points (content script, main iframe app) |
| `src/components/` | Feature UI (Calendar, Exams, SubjectFileDrawer, etc.) |
| `src/store/slices/` | Zustand domain slices (schedule, exam, files, i18n, theme, sync) |
| `src/services/` | Business logic: `storage/` (IDB), `sync/` (background sync) |
| `src/api/` | Network fetch functions per domain |
| `src/injector/` | Content script DOM injection and IPC |
| `src/hooks/` | React hooks (prefer store hooks for data) |
| `src/types/` | TypeScript type definitions |
| `.agent/` | Project rules, workflows, and agent personas |
