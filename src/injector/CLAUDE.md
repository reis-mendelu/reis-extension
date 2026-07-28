# Host Integration Contract

The extension uses a **push-based postMessage IPC** for each injected host. There are exactly two execution contexts: the **content script** (runs on the host page, has auth cookies) and the **iframe app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse.

> The **Isolation rules** for hosts live in the root `CLAUDE.md` — they are always-loaded prohibitions.

## IS Mendelu (`is.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/content.ts` | Registers `handleMessage`, calls `startInjection()` |
| Iframe injection + queue | `injector/iframeManager.ts` | `injectIframe()`, `markIframeReady()`, `sendToIframe()` |
| Data fetching | `injector/syncService.ts` | `startSyncService()` → `syncAllData()` → `sendToIframe(REIS_SYNC_UPDATE)` |
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

**ISKAM-specific behaviors:**
- The content script replaces the entire WebISKAM page via `document.open/write/close` — it owns the DOM entirely, there is no partial injection.
- `syncIskamData()` calls `fetchDualLanguageIskam()` (fetches profile + reservations in CZ and EN in parallel). If the session is expired, the fetch throws `IskamAuthError`; the handler then redirects to `${ISKAM_BASE}/ObjednavkyStravovani` to re-authenticate, rather than sending an error to the iframe.
- `ISKAM_FETCH_BLOCK` is a message type the iframe sends to request a block fetch. The handler in `iskamMessageHandler.ts` performs the fetch and sends the result back.
- On `logout`, the message handler clears all IDB data then redirects to the IS Mendelu logout URL.
