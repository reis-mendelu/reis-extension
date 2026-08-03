# Mobile action dispatcher — design

**Goal:** study documents download in one tap on the Capacitor app.
**Scope:** the `REIS_ACTION` loopback (issue #170 / Task 1 of
`docs/superpowers/plans/2026-08-02-capacitor-remaining-work.md`), documents first.

Everything below is traced to `file:line` in the tree at `cbfff7ef`.

---

## What is broken

Tapping *Download* in `DocsSheet` calls `useDocumentDownload.run()`
(`src/hooks/data/useDocumentDownload.ts:27`) → `downloadDocument()`
(`src/api/proxyClient.ts:43`) → `executeAction` posts a `REIS_ACTION`. The only
responder is the **content script** (`src/injector/messageHandler.ts:45`), which
does not exist on Capacitor. The promise sits until `REQUEST_TIMEOUT`
(30 s, `src/api/proxy/pendingRequests.ts:4`) and the row shows a red error icon.

**Two separate breakages sit behind that one button**, and both must be fixed:

1. **No responder.** Nothing on the app side handles `REIS_ACTION`.
2. **The fetch is CORS-blocked even if routed.** `downloadDocumentInPage`
   (`src/injector/documentDownloader.ts:14`) uses a bare
   `fetch(url, { credentials: 'include' })`. IS denies CORS to every origin, so
   this cannot succeed from the app's own origin. Its *save* half is already
   mobile-aware (`saveBlob` + `buildSaveDeps`); only the *fetch* half is not.

### Two traps found while tracing

- **The reply path is blocked too.** `initProxyListener`
  (`src/api/proxy/messageListener.ts:15`) rejects any message whose origin is not
  `https://is.mendelu.cz`. On Capacitor the app's origin is `https://localhost`
  (Android) / `capacitor://localhost` (iOS), so a correct `REIS_ACTION_RESULT`
  posted back would be **silently dropped**. Sync escapes this only because
  `useAppLogic`'s handler checks `e.source`, not origin.
- **There are two senders.** `executeAction` awaits a result, but `SyncService`
  (`src/services/sync/SyncService.ts:22-26`) fires `trigger_sync`,
  `trigger_drive_backup` and `refresh_exams` as raw `window.parent.postMessage`
  with no promise at all. The exam-refresh half of #170 lives entirely in the
  second one.

### Only four of the eleven actions are reachable

#170 lists eleven. Verified against the tree:

- `register_exam` / `unregister_exam` — **already dead call paths.**
  `useExamActions` (`src/components/ExamPanel/useExamActions.ts:29,34`) calls
  `registerExam()` / `unregisterExam()` directly in-process via `fetchWithAuth`.
  Nothing sends these actions. This is why registration already works on device.
- `open_url` — **zero callers.** `openPopup` (`src/api/proxyClient.ts:36`) is dead code.
- `toggle_outlook_sync` / `download_file` — in the `ActionType` union but have no
  `case` in the content script either. Dead on every platform.
- `trigger_drive_backup` / `push_notes` / `push_notes_html` — Drive, broken on
  mobile on four axes (#168), out of scope.

Leaving **`download_document`, `refresh_exams`, `trigger_sync`, `logout`**.

---

## Design

### 1. The dispatcher

New `src/mobile/actionHandler.ts`, installed from `capacitor/main.capacitor.ts`
inside `boot()` **before** the React root is imported, so an action fired during
first paint is not dropped. It listens on `window` for `REIS_ACTION`, ignores
anything whose `source` is not its own window, runs the action, and replies with
`sendToIframe(Messages.actionResult(id, ...))` — which on Capacitor loops back to
the same window (`src/injector/iframeManager.ts:73`).

This mirrors the `sendToIframe` precedent rather than inventing a second pattern,
and both senders work untouched: on a top-level window `window.parent === window`,
so `SyncService`'s fire-and-forget posts land on the listener for free. **No edits
to UI, hooks, or store.**

`src/injector/messageHandler.ts` is deliberately **not** reused. #170 proposed
sharing its switch, but only 4 of 11 cases are pure in-process calls; the ones
that matter (`download_document`, `open_url`, `logout`) are DOM-bound and diverge
completely. The shared surface is too thin to justify the abstraction, and not
importing it keeps its module-scope `chrome.runtime.getURL`
(`messageHandler.ts:23`) out of the mobile bundle — no guard needed.

### 2. The documents path

The mobile branch reuses `openIsFileNatively` (`src/mobile/openIsFile.ts:40`) —
the device-verified path subject files already use — plus one addition: an
optional **filename override**, because study documents carry a chosen name
(`Potvrzeni_o_studiu.pdf`, `src/api/studyDocuments.ts`) while subject files take
theirs from `Content-Disposition`.

The download becomes: native `CapacitorHttp` GET with the replayed `UISAuth`
cookie → `fetchIsBinary` → Downloads + notification on Android, share sheet on
iOS (`src/mobile/deliverFile.ts`). `toDirectDownloadUrl` returns `null` for a
`tisk_dokumentu.pl` URL and falls through unchanged, which is correct. If IS
returns HTML, `fetchIsBinary` already separates "session lapsed" from
"authenticated page" and `openIsFileNatively` throws rather than saving a web
page as a `.pdf`.

`downloadDocumentInPage` stays the extension's, unchanged.

### 3. The action table

| Action | Mobile |
|---|---|
| `download_document` | native fetch + deliver — **the fix** |
| `refresh_exams` | `refreshExams()` (`src/injector/syncService.ts:459`), in-process |
| `trigger_sync` | `syncAllData()`, in-process |
| `logout` | pending decision — falls under the default for now |
| everything else | **throws immediately, naming the action** |

That default carries real value. Today *any* unhandled action hangs 30 s and then
shows a generic error. After this it fails in milliseconds with its own name, so
the Drive actions stop masquerading as network problems.

### 4. Supporting edit: the origin allowance

`initProxyListener` gains an allowance for the app's own origin when the platform
is Capacitor. The `e.source !== window.parent` check stays, so on a top-level
window only same-window posts pass — no widening of what a hostile frame can do.

### 5. Logout — decided: **C, defer**

Current mobile behaviour is worse than "does not work": `logout()`
(`src/api/proxyClient.ts:47`) wipes IndexedDB **first**, then hangs 30 s. The
student is left with an emptied app and a still-valid token.

**Chosen: C — defer** until POST support lands (Task 3), then implement a real
server-side logout. (A was a local-only sign-out; B was leaving it dead.)

Deferring the *implementation* does not mean keeping the destructive half.
`logout()` now bails on Capacitor **before** clearing anything, and the mobile
profile sheet catches the rejection to show a toast — an unhandled rejection
there would fire a telemetry report on every tap and tell the student nothing.
Extension behaviour is untouched.

**When Task 3 lands**, the mobile branch replaces that throw with a real
`/auth/system/logout.pl` POST followed by the existing clear-and-reload; the UI
needs no change, and `settings.logoutUnavailable` can be removed.

---

## Testing

Unit tests on the pure pieces (`src/mobile/__tests__/`, dependency-injected deps,
no Capacitor imports — the existing pattern):

- dispatcher routes each supported action to its dep
- unsupported actions reject immediately, with the action name in the message
- a message from another window `source` is ignored
- failures reply `success: false` rather than throwing into the listener
- the filename override reaches `deliverFile`; absent, `Content-Disposition` wins
- the origin allowance accepts the app's own origin on Capacitor and still
  rejects a foreign one

### Outcome (2026-08-03)

Device-verified on Android with a live session: **`Registracni_arch.pdf` lands in
Downloads** (64851 B, `%PDF-1.5`) through the same GET the extension makes. The
mobile path is correct end to end — dispatcher, native transport, filename
override, delivery.

The other four rows fail, and **not for a reason in this codebase.** IS's sealed
(`_el`) endpoints are answering "Operaci se nepodařilo úspěšně dokončit. Request
body constraint violation" — reproduced by the user in a plain desktop browser,
outside reIS. Ruled out from our side by measurement: browser-like
UA/Accept/Referer, `;obdobi=`, repeats, and body headers (an httpbin echo shows
CapacitorHttp sends a clean GET with no Content-Length). `reg_arch_tisk` works
precisely because it is the one document with no sealed variant.

A fallback-to-unsealed was built and then **reverted on the user's call**: the
desktop implementation was correct, and product code should not be restructured
around a temporary server outage. `studyDocuments.ts`, `documentDownloader.ts` and
the sheet copy are therefore unchanged from `main`. When MENDELU repairs their
side, the existing `_el` triggers start working again on both platforms at once.

**Device verification is non-negotiable.** The failure class here is *silent* —
`a.download` on a blob URL saves nothing and throws nothing on Android
(`src/mobile/saveDocument.ts`). Build, install, tap all five document rows,
confirm the PDFs land in Downloads with a notification.

## Out of scope

- **Session-expiry re-auth on mobile.** A lapsed `UISAuth` shows a row error
  rather than re-presenting the login WebView. App-wide gap, not a documents one.
- **The "Žádost" row's `target="_blank"`** escape to a session-less system
  browser (`DocsSheet.tsx:84`, Task 8) — separate fix, does not block downloads.
- Drive backup (#168), secure token storage (#172), iOS build (#174).
