# Host Integration Contract

The extension uses a **push-based postMessage IPC** for each injected host. There are exactly two execution contexts: the **content script** (runs on the host page, has auth cookies) and the **iframe app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse.

> The **Isolation rules** for hosts live in the root `CLAUDE.md` — they are always-loaded prohibitions.

## IS Mendelu (`is.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/content.ts` | Registers `handleMessage`, calls `startInjection()` |
| Iframe injection + queue | `injector/iframeManager.ts` | `injectIframe()`, `markIframeReady()`, `sendToIframe()` |
| Sync triggers | `injector/syncGate.ts` | `startSyncService()`, `requestSync(reason)` — the one gate every sync passes through |
| Data fetching | `injector/syncService.ts` | `syncAllData()` → `sendToIframe(REIS_SYNC_UPDATE)` |
| Per-resource freshness | `injector/syncTtl.ts` | `ttlGated()` — volatility tiers, so a run fetches only what is due |
| Message routing | `injector/messageHandler.ts` | Handles `REIS_READY` → flush queue; handles actions/fetch/data |
| Iframe bootstrap | `entrypoints/main/main.tsx` → `hooks/useAppLogic.ts` | IDB hydration → signal `REIS_READY` → listen for `REIS_SYNC_UPDATE` |
| Skeleton guard | `store/slices/createSyncSlice.ts` | `handshakeDone` / `handshakeTimedOut` (10s) unblock skeletons |

## WebISKAM (`webiskam.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/webiskam.content.ts` | `document.open/write/close` to take over the page, registers `handleIskamMessage`, calls `startIskamSync()` |
| Iframe injection + queue | `injector/iskamInjector.ts` | `startIskamInjection()`, `markIskamIframeReady()`, `sendToIskamIframe()` |
| Data fetching | `injector/iskamSyncService.ts` | `startIskamSync()` → `syncIskamData()` → `sendToIskamIframe(ISKAM_SYNC_UPDATE)` |
| Message routing | `injector/iskamMessageHandler.ts` | Handles `ISKAM_READY` → flush queue + send current state; handles `ISKAM_FETCH_BLOCK` and `logout` |
| Iframe bootstrap | `entrypoints/iskam/IskamApp.tsx` | IDB hydration → signal `ISKAM_READY` → listen for `ISKAM_SYNC_UPDATE` |
| Skeleton guard | `store/iskamStore.ts` | `handshakeDone` / `handshakeTimedOut` (10s) unblock skeletons |

## Sync scheduling (IS Mendelu, shared with the mobile app)

`syncAllData` is never called directly — every trigger goes through
`requestSync(reason)` in `injector/syncGate.ts`, and both platforms share it.

| Reason | Fired by | Foreground-gated | Subject to `MIN_SYNC_GAP` | Clears TTL stamps |
|---|---|---|---|---|
| `boot` | `startSyncService()`, first `REIS_REQUEST_DATA('all')` | no | no | **yes** |
| `tick` | the `SYNC_INTERVAL` timer | yes | yes | no |
| `poke` | `bgPokeListener` (background alarm) | yes | yes | no |
| `resume` | Capacitor `resume` | no — resume *is* foreground | yes | no |
| `user` | `trigger_sync` action, post-re-login resync | no | no | **yes** |

- Automatic runs also take a per-origin Web Lock (`SYNC_LOCK_NAME`) with
  `ifAvailable`, so N open IS tabs no longer mean N simultaneous crawls. `boot`
  and `user` queue for it instead, bounded by `SYNC_LOCK_WAIT_MS`.
- `boot` and `user` are the **full crawls**: both mean "fetch everything, now",
  both clear the TTL stamps, and only one runs at a time — a second such request
  joins the one already going (`fullCrawl`, which spans the lock wait as well as
  the run) rather than queueing a duplicate behind it. Automatic runs are
  partial, so they never stand in for one: a `user` request waits for an
  in-flight tick to finish and then runs its own.
- `syncTtl.ts` holds its stamps **in memory on purpose**: a fresh content script
  starts empty and does one full crawl, so a skip can never leave a surface with
  no data. A resource is skipped only when this context already holds the value
  *and* the stamp is young.
- Adding a fetch to `syncAllData`? Wrap it in `ttlGated` with the tier that
  matches how fast it really changes. `TTL.HOT` (never skipped) is for grades,
  submissions and exam terms only.

**ISKAM-specific behaviors:**
- The content script replaces the entire WebISKAM page via `document.open/write/close` — it owns the DOM entirely, there is no partial injection.
- `syncIskamData()` calls `fetchDualLanguageIskam()` (fetches profile + reservations in CZ and EN in parallel). If the session is expired, the fetch throws `IskamAuthError`; the handler then redirects to `${ISKAM_BASE}/ObjednavkyStravovani` to re-authenticate, rather than sending an error to the iframe.
- `ISKAM_FETCH_BLOCK` is a message type the iframe sends to request a block fetch. The handler in `iskamMessageHandler.ts` performs the fetch and sends the result back.
- On `logout`, the message handler clears all IDB data then redirects to the IS Mendelu logout URL.
