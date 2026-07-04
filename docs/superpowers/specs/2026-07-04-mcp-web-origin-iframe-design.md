# Driving reIS live under Chrome MCP — Design Spec

**Date:** 2026-07-04
**Status:** Implemented & verified

## Problem / root cause

Chrome MCP (the `claude-in-chrome` extension) cannot screenshot, script, or click
the reIS UI on `is.mendelu.cz`. Every `computer`/`javascript_tool`/`read_page`
call on such a tab throws:

> `Cannot access a chrome-extension:// URL of different extension`

**Root cause (verified, not the symptom):** reIS renders its whole UI inside an
iframe whose `src` is `chrome-extension://<reis-id>/main.html`. `claude-in-chrome`
is *itself* an extension, and **Chrome forbids one extension from accessing
another extension's frame**. So the moment reIS's cross-extension iframe exists in
the tab, MCP is locked out of the entire tab. This is a hard Chrome security
boundary — MCP can *never* be granted access to that frame. The reIS app itself
renders fine for a human; only automated introspection is blocked. It never
happens without MCP (confirmed by the user).

## Solution: serve the iframe from a web origin in a dedicated build

An *external* origin (not `chrome-extension://`) is fully accessible to MCP. So in
a **`build:mcp`** build, the content script points its iframe at a localhost dev
server serving the real iframe app, instead of the packaged extension page.

Feasible because:
- The iframe app (`src/entrypoints/main`) uses **no `chrome.*` APIs directly** —
  it is fed entirely by postMessage; a small `chrome` stub covers the store's
  `chrome.storage` use.
- IS pages send **no CSP `frame-src`** (only `X-Frame-Options: SAMEORIGIN`, which
  governs *being framed*, not *framing*), so a localhost iframe is allowed.
  `http://localhost` is exempt from mixed-content blocking.
- All iframe→parent `postMessage` calls use `'*'` target origin, so the handshake
  works cross-origin.

## Implementation

| Piece | File |
|---|---|
| iframe src / origin resolver (env-gated) | `src/injector/iframeManager.ts` — `resolveIframeSrc()`, `resolveIframeOrigin()` |
| content-script message-origin check tracks the same flag | `src/injector/messageHandler.ts` |
| dev server serving the **real** app at `:5199` (chrome stub + mock data + assets) | `dev-iframe/` (`vite.config.ts`, `main.html`, `entry.tsx`, `chromeStub.ts`) |
| Tailwind scans app source under a non-root vite root | `src/index.css` — additive `@source "./**/*.{ts,tsx,html}"` |
| scripts | `package.json` — `iframe-dev`, `build:mcp` |

`VITE_IFRAME_ORIGIN` (set only by `build:mcp=http://localhost:5199`) flips both
`resolveIframeSrc()` (→ `…/main.html`) and `resolveIframeOrigin()` (→ the origin
the message handler accepts). Unset in the normal build → packaged
`chrome-extension://` page, **prod totally unaffected** (verified: no `localhost`
string in the normal build output).

## Two tiers of use

- **Tier 1 (quick, UI only):** `npm run iframe-dev`, then point MCP at
  `http://localhost:5199/main.html`. `VITE_USE_MOCK_DATA=true` populates the UI;
  no extension load, no IS login. Best for feature UI work.
- **Tier 2 (full, real IS data):** `npm run iframe-dev` **and** `npm run build:mcp`
  → load unpacked → visit `is.mendelu.cz/auth/`. The content script frames
  localhost; real synced data flows over the origin-agnostic postMessage IPC.

## Known limitations

- WebISKAM (`iskamMessageHandler.ts`) still hard-codes the extension origin — the
  same fix could be applied if ISKAM needs live MCP debugging (out of scope).
- The default mock dataset has no study plan, so the Předměty tab shows an empty
  state under Tier 1; other views (calendar, exams badge) populate.

## Out of scope (YAGNI)

- Auto-loading the unpacked extension (Chrome file picker can't be automated).
- Switching the whole project to Playwright MCP (considered; A keeps the existing
  `claude-in-chrome` workflow with a small, prod-safe code change).
