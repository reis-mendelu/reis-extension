# Capacitor — remaining work

Continuation of `2026-08-02-capacitor-shell.md`. That plan's Tasks 1–7 are done; the
shell boots, authenticates, syncs, and downloads files on Android.

This document is the **resume point**. Everything below is either measured or traced to
`file:line` — none of it is speculation. Ordered by what blocks the most.

**Read first:** `docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md` (device
measurements) and `2026-08-02-capacitor-transport-decision.md` (why Model C).

---

## Where it stands

*Updated 2026-08-08, after a UI-polish round (#192–#194) and secure storage (#195).*

**THE DEVICE PASS HAPPENED.** Handset A001, 1080x2392, dpr 2.625. Cold start → login →
**115 requests, all HTTP 200, zero telemetry**, covering all four Task 4 endpoint families
(`student/list.pl` prubezne+test, `odevzdavarny.pl`, `studijni_povinnosti.pl`,
`wifi/certifikat.pl`) plus 4 POSTs (`rozvrhy_view.pl` cz/en). The whole
"silently CORS-blocked on Capacitor" class is confirmed dead on hardware.

**How to debug this app on a device — reuse this, it found every root cause below.**
The debug build exposes the WebView over Chrome DevTools Protocol:
`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`, then drive
`Runtime.evaluate` over the websocket (Node 22+ has a global `WebSocket`; no dependency
needed). That gives real geometry, scrollTop, computed styles, event streams — and it can
fetch authenticated IS HTML on demand, which is exactly the "real IS sample" this repo
requires before touching a parser. **Screenshots repeatedly lied** (one caught a login sheet
mid-close and read as a failure; two raced a toast). Resolve tap targets from the DOM in
device px (`rect * devicePixelRatio`), never by eyeballing a screenshot. Gate every
screencap on `dumpsys window | grep mCurrentFocus` containing `cz.reis.app` — this is the
user's personal phone.

**Fixed and device-verified this session**

| Symptom | Root cause | Verified |
|---|---|---|
| Downloads "do nothing" | File saved fine (577500 B); the only feedback was a notification, and `POST_NOTIFICATIONS` was never requested → denied → silence | Toast on device; permission now `granted=true` |
| Every file badge reads "FILE" | **IS changed its markup**: `img[sysid]` → `span[data-sysid]`. Zero `img[sysid]` left. **Hits the extension too** | Badges read PDF / DOCX / ZIP |
| Header under the status bar | `ScreenHeader` used flat `pt-5`, never read `--safe-top` (which correctly reports 48px) | Date title clear of the clock |
| Sheets won't swipe closed | `Sheet` drew a drag pill with no drag handling; adding one was not enough — `touch-action: auto` let the browser claim the drag and fire `pointercancel` after ~20px of a 350px swipe | Panel 1 → 0 on a header drag; content still scrolls |
| Two identical IS links per tab | Tab bodies render `ISBacklink` while the sheet pins its own footer | Exactly 1 link on all 5 tabs |
| Back quits from vývěska | The overlay is NOT a sheet — own `bulletinExpanded` flag, portals to body, so the stack read empty | Back closes overlay, app stays |
| Feedback is a desktop popup | Centred card on phones | Bottom sheet: flex-end, 20px top radius, flush |

Also verified on device: eduroam sheet opens from settings and renders the extraction
password with **no telemetry report** (the old symptom); map has no Knihovna tab; settings
has the eduroam row and no Drive toggle.

---

*Previous update, after PR #185 (Task 4, Task 8 external links, session recovery).*

⚠️ **One coverage gap knowingly accepted at merge:** `searchService` moved from a direct
iframe `fetch` onto the content-script proxy, and nothing tests that hop end to end —
`e2e/tests/search.spec.ts` only asserts the search bar renders, and **CI does not run e2e at
all**. The mechanism is proven in production elsewhere (`events.ts:57` POSTs through the same
proxy, as does `outlookSync`), and the URLs and bodies are unit-pinned, but a real search query
on the extension is the check that would actually confirm it.

| Area | State |
|---|---|
| Shell: boot, login, session restore, back button | **Done**, device-verified on Android |
| Transport (`CapacitorHttp`, per-platform cookie) | **Done** — GET **and POST**, plus raw bytes |
| Sync (14 endpoints, ~236 requests) | **Done**, device-verified — 115 requests, all HTTP 200 |
| File download → Downloads + notification | **Done**, device-verified |
| Duplicate file listings | **Fixed** (also fixes the extension) |
| Study documents (Task 1/2) | **Done**, device-verified — PR #179 |
| eduroam cert fetch (Task 3 + eduroam half of Task 4) | **Done** — superseded by the native path (#189), proven on hardware |
| Bare `fetch` sites (Task 4) | **Done**, device-verified — `serverTime` excluded on purpose |
| Search, cvicne testy, odevzdávárny, kontrola | **Done** — search device-verified (people + subjects, person card fills) |
| External links → in-app browser (Task 8) | **Done** — ⚠️ still **unverified on a device**, one of two owed checks |
| Re-login after a lapsed session | **Done**, prompt-first — device-verified via the #172 purge, which forced a real re-login |
| Secure storage for `UISAuth` (Task 6) | **Done on BOTH platforms** — Android Keystore (#195), iOS Keychain, each verified |
| iOS app | **Builds and runs** (simulator, 2026-08-08). Logged in, 121 IS requests, no login redirects |
| Native Wi-Fi (eduroam, Android) | **Done**, device-verified — Task 5 |
| ISKAM, Drive | **Broken** — see below |

~~**Everything shipped since PR #181 is unit-tested only.**~~ **Largely closed.** Two
handset sessions (2026-08-07, 2026-08-08) verified sync, downloads, search, back
navigation, the map sheet and secure storage on real hardware. The warning that produced
this line still stands as a rule, though: this transport's record is *four* bugs shipping
green because the tests stubbed shapes the native layer never produces (Task 3) — and this
session added a second class, where jsdom cannot express `touch-action` at all, so a
gesture can pass every test and still be dead on a device.

## What is still owed

*Rewritten 2026-08-08. The five items that stood here are resolved except where noted.*

**1. ~~iOS has still never been compiled~~ — DONE 2026-08-08 (#174).** It compiles, launches,
signs in and syncs: **121 IS requests with zero login redirects and zero telemetry**, the token
served from the Keychain on every one of them. The inverted cookie delivery is therefore
exercised too — iOS's explicit `Cookie` header carried all of it. What remains on iOS is
narrower than "unmeasured": the share-sheet download branch, a clean-install login (proven once,
not repeatedly), the default app icon, and no analogue of the Android back-button chain. Full
detail and the plugin-packaging rule in Task 7.

**2. Two device checks, neither needing new code.** External links must open **in-app and
authenticated**, not in Chrome. And the map sheet's drag-vs-scroll hand-off is unverified
because the Akce list currently has no events, so nothing overflows to scroll against —
that path is `dragOwnsGesture` + `consumesTravel`, both unit-tested.

**3. Lower-severity credentials.** Google OAuth tokens still sit in plain storage (#196,
found while doing #172). Lower bar than UISAuth was: `drive.file`-scoped, they expire,
and they are revocable. The Discord webhook still ships in the client bundle (#163/#183).

**4. UI polish backlog.** `MobileSearchOverlay` still lacks its `--safe-top` inset and is
BLOCKED by pre-existing react-hooks lint debt in the same file (a setState-in-effect error
on HEAD) — the changed-files CI gate makes that file untouchable until the effect is fixed.
The map's floating search bar had the same defect and is fixed (#193); it was the only
other top-anchored surface that did not inherit the inset from `ScreenHeader`.

**5. Unchanged.** Drive on mobile (#168) is hidden rather than fixed. Tablets still get the
desktop tree (#175). Three unguarded IDB reads can still setState after unmount (#176).

### Resolved since this list was written

- ~~predictive-back gesture~~ **confirmed by thumb.** It exposed a separate defect — back
  from any non-calendar tab *quit the app*, because `handleBackPress` knew about sheets and
  the bulletin but never about `mobileTab`. Fixed in #192; the chain is now
  sheet → bulletin → tab → exit, with calendar as the start destination.
- ~~eduroam~~ **native Android one-tap merged** (#189) — see Task 5. The cert-bytes check is
  moot: the native path proved the whole chain on hardware.
- ~~search~~ **verified on device** — people *and* subjects, live from IS, person card fills.
- ~~secure storage for UISAuth~~ **done for Android** (#172 / PR #195) — see Task 6.

**6. Other parsers may share the FILE bug.** IS's `img[sysid]` → `span[data-sysid]`
migration is unlikely to stop at the document server. Audit `grep -rn "sysid" src/` and
verify each against real IS HTML via the CDP route above.

---

**The original device checklist, for reference.** It started as eduroam-only and grew:

1. **eduroam** — sheet opens with no telemetry report; extraction password renders; the
   POST returns an authenticated page; both certs start `0x30 0x82`. Full method and the
   `gen=`-omission warning in Task 3.
2. **zaznamnik** — open a subject with průběžné hodnocení and confirm scores appear.
3. **search** — the search box returns people *and* subjects; `PersonHoverCard` fills.
4. **subject files** — open and download from `SubjectDrawerSheet`.
5. **external links** — the ISKAM card and "Otevřít v IS MENDELU" open *in-app* and
   *authenticated*, not in Chrome.
6. **re-login** — let a session lapse, confirm the toast offers sign-in, that tapping it
   opens the login WebView once, and that data flows again afterwards.

~~**"Sync is done" has one hole.**~~ `syncZaznamnik` runs *inside* the same sync
(`injector/syncService.ts:381`) but reached IS through a bare `fetch`, so it was
CORS-blocked on Capacitor: continuous assessment — průběžné hodnocení and practice-test
scores — silently never arrived on the phone while everything around it did. **Now on
`fetchWithAuth`** (`api/zaznamnik.ts:194`), like its thirteen siblings in the same run.
Unit-tested, **not yet seen on a handset** — fold it into the device check owed in Task 3:
open a subject with průběžné hodnocení and confirm scores appear.

---

## Task 1 — The `REIS_ACTION` loopback ✅ DONE (PR #179, `1ad5d030`)

Shipped as `src/mobile/actionHandler.ts`, an app-side responder that receives
`REIS_ACTION` from its own window. Study documents download in one tap and the exam list
refreshes after a write — both device-verified on Android against a live session
(`Registracni_arch.pdf`, 64851 B, `%PDF-1.5`).

Two traps found while tracing, both handled: the **reply** path was origin-blocked too
(`initProxyListener` trusted only `is.mendelu.cz` — hence `src/api/proxy/trustedOrigin.ts`),
and `SyncService` is a second, promise-less sender. Only **4** of the eleven actions below
are actually reachable: `register_exam`/`unregister_exam` are called in-process by
`useExamActions`, and `open_url` has zero callers.

`logout` is still deliberately absent — the transport can POST now, but a real server-side
sign-out was scoped out. `proxyClient.logout()` throws early on Capacitor *before* clearing
IndexedDB, so a student is never left with an emptied app **and** a live IS session.

Design: `docs/superpowers/specs/2026-08-03-mobile-action-dispatcher-design.md`.

<details><summary>Original analysis, kept for the file:line map</summary>

`executeAction` (`src/api/proxyClient.ts:25-33`) posts `REIS_ACTION` and waits for
`REIS_ACTION_RESULT`. The only responder is `src/injector/messageHandler.ts:45` — the
**content script**, which does not exist on Capacitor. Eleven actions are affected:

```
register_exam · unregister_exam · refresh_exams · trigger_sync · trigger_drive_backup
download_document · push_notes · open_url · logout · toggle_outlook_sync · download_file
```

**Precedent to copy:** `sendToIframe` (`src/injector/iframeManager.ts:57`) already gained a
Capacitor branch that posts to its own window, and `useAppLogic` accepts it because
`window.parent === window` at top level. Do the same for actions: an app-side handler that
receives `REIS_ACTION` from its own window and replies with `REIS_ACTION_RESULT`, reusing
`messageHandler`'s logic rather than reimplementing it.

⚠️ `messageHandler.ts:23` calls `chrome.runtime.getURL` at module scope — importing it
into the Capacitor bundle will throw. Extract the switch, or guard that line.

**What this fixes immediately:**
- **Study documents** (`DocsSheet`) — currently spins 30 s (`REQUEST_TIMEOUT`,
  `src/api/proxy/pendingRequests.ts:4`) then shows a red error icon.
- **Exam refresh** — see Task 2.

</details>

## Task 2 — Exam refresh after a write ✅ DONE (PR #179, `1ad5d030`)

Fixed by the same handler — `refresh_exams` is one of the actions it answers.

<details><summary>Original analysis</summary>

**Correction to an earlier belief: exam registration itself WORKS on mobile.** The write
goes through `fetchWithAuth`. What is dead is the follow-up.

`useExamActions.ts:34,62` and `useWatchdog.ts:74` call `triggerExamsRefresh()` →
`SyncService.ts:25` → a `REIS_ACTION` nobody receives. So `examsRefreshing` sticks for its
15 s timeout and no authoritative re-read happens; the optimistic update carries the UI
until the next 5-minute sync.

**Riskiest case:** switching terms (`useExamActions.ts:24-46`) — after a *failed* switch
the student sees a stale list with no re-read, the one case where trusting the optimistic
state is wrong.

`refreshExams()` already exists in-process (`src/injector/syncService.ts:459`), so once
Task 1 lands this may be as small as calling it directly.

</details>

## Task 3 — Transport gaps: POST and raw bytes ✅ DONE (PR #181, `c9e6160f`)

`fetchViaCapacitor` now takes an options bag (`method`/`body`/`headers`) and dispatches
POST to `httpPost`. Raw bytes are a **sibling** function, `fetchAuthedBytes(url)`, not an
option on `fetchWithAuth` — `fetchWithAuth` imposes `DEFAULT_HEADERS` (`accept: text/html…`),
which are wrong when asking for a `.p12`. The `logout.pl` check stays HTML-only, so it
never runs against binary.

Design: `docs/superpowers/specs/2026-08-03-capacitor-transport-post-bytes-design.md`.

### ⚠️ Still owed: the Android device check

Merged on unit tests alone. Verify on a handset:

- opening the eduroam sheet fires **no** telemetry report
- the extraction password renders
- the POST reaches IS and returns an authenticated page
- both cert downloads start `0x30 0x82` (DER SEQUENCE) — **assert the magic bytes, not a
  non-zero length**; an HTML error page is also non-empty, and that is the exact failure
  this is meant to catch

Send `data: 'lang=cz'` **without `gen=`** while testing, so no certificate is actually
generated — generating one rotates a 366-day credential the student may already have
installed on other devices.

### What the unit tests could not see

Four real bugs shipped green and were caught only in review, all because the tests stubbed
shapes the **native layer never produces**. Assume this trap on any future transport work:

- a `URLSearchParams` body → the bridge JSON-stringifies it → `"{}"`, an empty POST
- a JSON body → both native layers parse JSON *before* it crosses the bridge, so `res.data`
  is an **object**; `String(obj)` gave `"[object Object]"`
- the `logout.pl` gate applied to JSON rejected healthy schedule responses
- a `Text/Html` content-type slipped exact-cased guards, returning a login page as
  certificate bytes (`Headers` lowercases header *names*, not *values*)

## Task 4 — Bare `fetch` call sites that bypass the transport ✅ DONE (except serverTime, deliberately)

These call `fetch(...)` directly instead of `fetchWithAuth`, so they are CORS-blocked on
Capacitor:

**The list below has now been wrong three times.** It originally held 5 files and a line
dismissing everything else as CDN/Google/Supabase; two review rounds on PR #182 found more
each time — and the third correction went the *other* way: `useFileActions` was listed as
open when it had already been migrated, because the grep sees `fetch(` but not the
`isNativeHost()` guard above it. Do not trust it as folklore — **re-derive it**, then open
each hit and check for a guard before calling it work:

```bash
grep -rn "\bfetch(" src/ --include='*.ts' --include='*.tsx' \
  | grep -v "__tests__\|\.test\.\|fetchWithAuth(\|fetchViaProxy(\|fetchJsonViaProxy(\|fetchAuthedBytes(\|fetchIsBinary(\|fetchViaCapacitor("
```

Grepping for `mendelu` on the same line as `fetch(` is what missed them — the URL is a
constant or a variable at most of these sites.

| File | Line | Reaches mobile via | State |
|---|---|---|---|
| `src/api/eduroam.ts` | ~~31, 37, 55~~ | eduroam sheet | ✅ done, PR #181 |
| `src/api/cvicneTests.ts` | ~~23~~ | subject detail | ✅ done — transport line only, parser untouched |
| `src/api/odevzdavarny.ts` | ~~56~~ | submissions | ✅ done |
| `src/api/kontrola.ts` | ~~17~~ | study check | ✅ done |
| `src/utils/serverTime.ts` | 29 | tablet-only path | **do NOT migrate** — see below |
| `src/api/zaznamnik.ts` | ~~186 (two in one `Promise.all`)~~ | **sync** — `syncZaznamnik` runs inside the main sync run (`injector/syncService.ts:381`), so continuous assessment silently never arrived on the phone | ✅ done — see below |
| `src/api/search/searchService.ts` | ~~22, 38, 57, 80, 102~~ | search + `PersonHoverCard` | ✅ done |
| `src/hooks/ui/useFileActions.ts` | ~~45, 85, 104~~ / 142, 144 | **`components/mobile/sheets/SubjectDrawerSheet.tsx`** | ✅ already native since PR #169 — see below |
| ~~`src/hooks/ui/useFileDownload.ts` + `useFileDownload/urlResolver.ts`~~ | — | nothing — dead code | ✅ deleted |
| ~~`src/utils/user_id_fetcher.ts`~~ | — | nothing — **orphaned**, zero importers | ✅ deleted |

**Task 4 is closed apart from one deliberate exclusion.** All seven migratable rows are on
`fetchWithAuth`, the three dead files are deleted, and `serverTime` is documented below as
a non-target. What is *not* done is device verification — every one of these is unit-tested
only, and this transport's record is that unit tests miss what the native layer actually
produces (see Task 3).

⚠️ **`serverTime.ts` must NOT be migrated. Migrating it breaks a working feature.** It is a
`HEAD` request whose entire purpose is reading the `Date` *response header*, and neither
transport can carry that:

- the iframe-proxy branch reconstructs a `Response` from text alone
  (`client.ts:68`), so `Date` is gone and `fetchServerTimeOffset` would fall to its 0-offset
  fallback on the extension, where it works fine today;
- `fetchViaCapacitor` throws on any method other than GET/POST by design, so `HEAD` cannot
  reach IS natively either.

It is also unreachable on mobile: its only consumer is `useAutoRegistration`, imported
solely by `ExamPanel/index.tsx` — the desktop tree. The mobile `ExamsScreen` uses
`useExamActions` and never touches it. On Capacitor it already degrades correctly (catch →
offset 0 → trust the local clock), which is the right answer for a clock-sync nicety. Leave
it alone; if the tablet path is ever supported (Task 8), the fix is a dedicated native
time probe, not this function.

**`searchService` is migrated** — all five sites, and each POST now sets **no Content-Type
of its own**. That is the fix for the `outlookSync.ts:73` defect recorded below, applied
pre-emptively: a capitalised `Content-Type` does not overwrite `DEFAULT_HEADERS`' lowercase
one, so IS would have received it twice. Both transports already supply exactly the right
value — `DEFAULT_HEADERS` on the extension, `capacitorTransport`'s POST-only default on
native. A test asserts no call carries a content-type header, so it cannot creep back.

Note this changes the extension path too: search ran a bare `fetch` from the iframe and now
hops through the content-script proxy like every other endpoint. The proxy handles POST with
a body (`messageHandler.ts:100`), and all five functions already swallowed failures into an
empty result, which the tests pin.

**The three dead files are deleted**, along with `hooks/ui/index.ts` — the barrel was
`useFileDownload`'s only referent, had zero importers of its own, and re-export barrels are
forbidden by the Iron Rules anyway. This also clears the one repo-wide lint error that lived
in `useFileDownload.ts` (42 → 41).

**`zaznamnik` is migrated.** Both fetches in the `Promise.all` now go through
`fetchWithAuth`, closing the sync hole described at the top of this document. The behaviour
change flagged in the warning below is real and was accepted deliberately: a 401/403 now
sends the student to `login.pl` instead of being swallowed into a `null` result. That is
what the other thirteen endpoints in the same sync run already do, and a 401 there means the
session is genuinely gone. The soft failure is otherwise preserved — a non-auth error still
returns `null`, because `syncZaznamnik` swallows per-subject failures and the slice's merge
guard keeps previously synced scores. The explicit `!phRes.ok` check stays: the iframe-proxy
branch of `fetchWithAuth` synthesises a 200 for everything, so without it a proxied failure
would be parsed as a real page. Tests: `api/__tests__/zaznamnikFetch.test.ts`.

**`useFileActions` was listed in error — the grep sees the `fetch(` calls but not the
`isNativeHost()` guards in front of them.** All three reachable sites (`openFile:45`,
`openPdfInline:85`, `downloadSingle:104`) already branch to `openIsFileNatively` /
`fetchIsBinary`; PR #169 migrated them along with the rest of the shell. The remaining two
(142, 144) are `downloadZip`, which `SubjectDrawerSheet.tsx:144` makes unreachable on phone
with `selectable={false}` and which Task 8 keeps desktop-only by product decision. Nothing
to migrate. `hooks/ui/__tests__/useFileActions.native.test.ts` now asserts that both
reachable methods reach `openIsFileNatively` and never touch `global.fetch`, so the guards
cannot silently regress.

**What the guards did leave broken, now fixed.** The native branches sat *outside* the
try/catch the web path has, and every caller drops the returned promise — the prop type is
`(link: string) => void` (`FileListItem.tsx:31`). So a failure from `openIsFileNatively`
(IS served a page, or the session lapsed) escaped as an **unhandled rejection**: a telemetry
report fired and the student saw a tap that did nothing. The native path now catches, routes
through `logError`, and toasts — naming a lapsed session separately, since that is the one
failure a student can act on. Extracted to `hooks/ui/openNativeFile.ts`; desktop behaviour
is untouched, since none of this is on the web branch.

`useFileActions.ts` is 208 lines, just over the 200-line convention. The natural next split
is `downloadZip`, deliberately left alone here — it is the desktop-only path this change had
no reason to disturb.

✅ ~~**Mobile still has no re-login route.**~~ **Built** — `mobile/sessionRecovery.ts`.
`recoverSession()` clears the dead token (without which `ensureSession` would short-circuit
and hand back the very token that failed) and re-runs the same login WebView boot uses —
now a shared `mobile/inAppLoginDeps.ts`, because ensureSession's cookie-polling contract
only holds if `onPageLoaded` and `readCookies` come from the WebView `openLogin` presented.
Single-flight, so a sync fanning out ~236 requests opens one login rather than a dozen.

**Prompt-first by decision: nothing here opens a login on its own.** A background sync must
not throw a full-screen WebView over whatever the student is reading, so
`promptSessionRecovery()` shows a non-expiring toast with a "sign in" action and lets them
choose. On success it re-syncs immediately — otherwise the student signs back in and is still
looking at the pre-expiry data until the next `SYNC_INTERVAL` tick.

⚠️ **A prompt must never be able to destroy a healthy session.** Two ways it could, both
fixed after #185 merged:

- The prompt is `duration: Infinity` with a stable id, so it did **not** disappear once the
  student signed back in. Left on screen, a second tap ran recovery again — which clears the
  token. `recoverSession` now dismisses it on success.
- A request issued *before* a re-login carries the dead token and can land well after it.
  That response is unauthenticated because *its* token is dead, not because the current
  session is. `promptSessionRecovery(failedToken)` now discards it by comparing against the
  token the last recovery installed — **exact, not a grace period**: there is no window to
  tune, and a genuine second lapse (which carries the *current* token) still prompts. The
  token is threaded from `capacitorTransport`/`capacitorBinary` for comparison only; it is
  never logged or transmitted.

  Consequently `hooks/ui/openNativeFile.ts` no longer raises the prompt itself — it returns
  silently on a lapsed session. The transport already prompted, *with* the token; a second
  call from there would pass none, which is precisely the case the filter cannot catch.

⚠️ **The notification fires from where the error is MINTED, not where it is caught.** This
was wrong in the first draft and both PR reviewers caught it. The original hook sat in
`syncAllData`'s outer catch, which *cannot* fire: `getUserParams` swallows into `null`
(`utils/userParams.ts:42`) and the whole fan-out is wrapped in `Promise.allSettled`. Nor
would a catch anywhere else have worked — search and the three GET endpoints swallow into
`null`/`[]` by design. `capacitorTransport` and `capacitorBinary` now call
`notifySessionExpired()` inside their `sessionExpired()` factories, the one point every
unauthenticated response passes through. A 5xx deliberately does NOT notify: IS being broken
is not the student being logged out.

`injector/syncService.ts` is consequently untouched by this branch, and
`services/sessionExpiry.ts` is a one-slot handler registry the Capacitor bootstrap fills and
the extension leaves empty. That registry is still load-bearing: `capacitorTransport` is
reachable from the content script, and importing the prompt there — even lazily — pulled
sonner, the login plugin, the store and both locale files into a script injected on every IS
page (416 kB → 966 kB). Measured back at exactly 416,547 bytes. Do not "simplify" it away.

⚠️ **Superseded note, kept for context:** on the extension, `messageHandler.ts:203`
redirects to `login.pl` when it sees `sessionExpired`; there is no Capacitor equivalent
anywhere, so the app can only *tell* the student their session died. Worth its own task —
it affects every authenticated path on mobile, not just files.

Two rows are traps rather than work: `useFileDownload` has no consumer but the
`hooks/ui/index.ts` barrel, and `user_id_fetcher.ts` has **no importer at all** — the live
path is `api/user.ts`, which already uses `fetchWithAuth` against the same URL. Migrating
either one is wasted effort; deleting them is the actual fix.

⚠️ Not a blind sed: `fetchWithAuth` also imposes `DEFAULT_HEADERS` and a 401/403 login
redirect, which changes **extension** behaviour. Check each call site. The remaining ones
are independent, so they need not land together.

These all work on the extension only because a Chrome extension's `fetch` bypasses CORS for
hosts in `host_permissions` — a privilege the Capacitor app does not have. That is the whole
reason this task exists, and why "it works in the extension" proves nothing here.

**Not Task 4 targets** (verified — "not a target" is not the same as "works"):

- `iskam/*` — **still broken on mobile**, just not fixable here: ISKAM is Shibboleth, a
  second sign-in flow rather than a transport problem, and is out of scope for a first
  release (see the status table and "Out of scope" below). Do not read this row as green.
- `injector/*` — content-script-only, so it never executes on Capacitor. `menuScraper` is
  imported solely by `injector/sniper.ts`.
- `client.ts:76,124` — the transport itself.
- `PdfViewer.tsx:15` — `chrome.runtime.getURL`, a local asset. (It *does* break on the
  tablet path, for a different reason — see Task 8.)
- `loadRealDataSnapshot`, `logger` — dev-only.
- CDN / Google / Supabase / MS-Bookings / Photon / HuggingFace / Discord-webhook — not IS,
  and CORS-clean.

~~**Adjacent, found while doing eduroam:**~~ ✅ **fixed.** `src/api/outlookSync.ts:73` passed
its own `Content-Type` into `fetchWithAuth`, which already sets a lowercase one — both keys
survive the object spread and `Headers` *appends*, so IS received
`"application/x-www-form-urlencoded, application/x-www-form-urlencoded"`, parsed no body,
and still answered 200 while the UI reported success. Confirmed against a spec-compliant
`Headers` before fixing. Extension-only; the Capacitor path forwards caller headers alone
and was unaffected.

⚠️ The test asserts the **cause** (no caller-set `Content-Type`), not the effect: happy-dom's
`Headers` *overwrites* duplicate keys instead of appending, so this class of bug cannot be
reproduced in this repo's test environment at all. Worth knowing before trusting a green
suite on any header-merging question.

## Task 5 — eduroam native one-tap (#159) ✅ Android DONE and device-verified (PR #189, `1b5b7fbd`)

**The Android half is written** (branch `worktree-eduroam-android-native`). What landed:

1. `android/.../EduroamPlugin.java` — a port of the spike's `EduroamProbePlugin`, which
   verified on API 35 with real MENDELU cert material that `ACTION_WIFI_ADD_NETWORKS`
   accepts an EAP-TLS config backed by a **self-signed** root. Java, not Kotlin: the app
   module has no Kotlin Gradle plugin. Registered in `MainActivity`.
2. `ACCESS_WIFI_STATE` + `CHANGE_WIFI_STATE` in the manifest — both normal permissions,
   granted at install, no runtime prompt.
3. `src/mobile/configureEduroam.ts` (pure, 11 tests) + `src/mobile/eduroamNative.ts`
   (the `registerPlugin` wiring and the capability gate).
4. `useEduroamSetup` native branch ahead of every file/transfer path; `EduroamSheet`
   drops to two steps on the phone. Android chosen in a *desktop* browser is untouched
   and still gets the QR transfer.

**Two departures from the sketch in #159, both deliberate:**

- **The identity is derived in the plugin, not passed from JS.** #159 is right that
  Android does not derive it (an empty Identity is what greys out CONNECT), but the
  plugin already opens the PKCS#12 for the private key, and the IS-issued cert's subject
  CN *is* `<login>@mendelu.cz`. Reading it there avoids both an extra `?get=user-der`
  request and a second ASN.1 parser in TypeScript. An explicit override still wins.
- **Unknown and missing result codes fail CLOSED.** Claiming success when the network
  was not saved sends a student to campus with wi-fi that never connects; the opposite
  mistake self-corrects, since a retry over a network that did save returns
  ALREADY_EXISTS, which reads as success.

**DEVICE-VERIFIED 2026-08-08** on the A001 handset (Android 16 / API 36), end to end
against the student's real IS certificate. `./gradlew :app:compileDebugJavaWithJavac`
succeeds (JDK 21 via `brew install openjdk@21`; the machine had no JVM at all before).

The flow: profile → eduroam → one tap → Android's own dialog
(**"Save this network? / reIS wants to save a network to your phone / eduroam"**,
activity `com.android.settings.wifi.addappnetworks.AddAppNetworksActivity`) → Save.
Two taps, exactly as promised.

`dumpsys wifi` afterwards, i.e. Android's record and not the app's claim:

```
ID: 73 SSID: "eduroam"
KeyMgmt: WPA_EAP IEEE8021X          (Type 3 + Type 9 → WPA2- and WPA3-Enterprise)
eap_method: TLS
identity "xholek1@mendelu.cz"
domain_suffix_match "mendelu.cz"
client_cert "keystore://USRCERT_..."
ca_cert     "keystore://CACERT_..."
```

**The identity line proves the design call.** It was derived inside the plugin from the
client cert's subject CN — no `?get=user-der` request, no ASN.1 parser in TypeScript —
and it produced the exact string EAP-TLS needs. The `keystore://` entries confirm the
framework auto-installs the key and CA: no cert-install dialog, no Settings dance.

A read-only check of `certifikat.pl` ran FIRST to confirm a certificate already existed
(issued 21 Jun 2026), so the flow read it and never POSTed `gen=`. **Keep that order** —
generating rotates a 366-day credential the student may have installed elsewhere.

**Re-running is safe, and that replaces "detection".** Verified on the same handset with
the network already saved: the system dialog appears again (Android does NOT pre-suppress
it), the result is `SUCCESS` rather than `ADD_WIFI_RESULT_ALREADY_EXISTS`, and network 73
is updated **in place** — `cmd wifi list-networks` still shows one `eduroam`, no duplicate.

Two consequences:

- The `already-configured` branch is kept as a defensive mapping (documented API, OEMs
  vary) but **nothing may depend on it** — it appears unreachable on Android 16.
- **Certificate expiry needs no special mechanism.** At ~366 days the student taps the
  same button and the credential is replaced in place. Renewal stays student-initiated
  because generating is an IS write; the *config* side is already idempotent.

**Detecting an existing eduroam config before setup is not possible, by design.**
`WifiManager.getConfiguredNetworks()` is deprecated at API 29 and since Android 10
returns only networks the calling app created. Scan results prove range, not
configuration. `getConnectionInfo().getSSID()` needs location permission and only answers
while connected on campus. So do not gate an onboarding prompt on detection — offer it,
record completion locally, and let idempotency absorb the rest.

**Build trap that cost a broken install.** `android/app/src/main/assets/public` is
**gitignored**, so a `cap sync`'d web bundle SURVIVES a branch switch while the Java does
not. Switching to a branch without `EduroamPlugin.java` and rebuilding produced an APK
with eduroam-aware JavaScript over Java that had no such plugin — Capacitor threw
"Eduroam plugin is not implemented on android", which the sheet then reported as
"couldn't prepare the profile". Always re-run `npm run build:capacitor && npx cap sync
android` after changing branches, and never trust an incremental APK across a switch.

**Still not verified:**

- **Association on campus.** Acceptance is not connection. The phone had no eduroam AP
  in range (`cmd wifi list-scan-results` was empty for it), so this still needs the
  handset on MENDELU grounds. It is now the ONLY unknown on the Android path.
- The **API 30 floor** is not gated in JS on purpose. `minSdkVersion` is 24, so Android
  7–10 devices reach the plugin and get an explicit rejection rather than a silently
  different flow. **Product decision still open:** leave them on the manual instructions,
  or raise minSdk.

**Still not started:**

4. iOS `NEHotspotEAPSettings` + entitlement — **still unverified** whether iOS accepts
   MENDELU's self-signed root. Blocked behind Task 7 (the iOS app has never been built).
   Note the same QR-pointing-at-itself absurdity exists on the iOS app today: target
   resolves to `ios`, which takes the transfer path. Pre-existing, not introduced here.
5. Cert expiry is 366 days and silent; renewal is a POST (an IS write) and must stay
   student-initiated.

## Task 6 — Secure storage for `UISAuth` ✅ DONE for Android (#172, PR #195)

> This was the one item with a security bar rather than a feature bar. **The Android half
> is closed.** iOS is deliberately unwritten — see below.

**The exposure, measured before the fix.** `adb shell run-as cz.reis.app cat
shared_prefs/CapacitorStorage.xml` returned the live token in plaintext, 56 characters.

**What landed.** `android/.../SecureStorePlugin.java` encrypts with AES-256-GCM under a key
generated *inside* the Android Keystore — hardware-backed where a TEE/StrongBox exists,
unexportable, never in the JS heap. Only ciphertext is persisted. Hand-written rather than
taken as a dependency because it sits on the credential path and because the obvious
library, `androidx.security:security-crypto` (`EncryptedSharedPreferences`), **was
deprecated in April 2025** — check this before reaching for it again.

`secureStorage` joins `ReisPlatform` (`src/platform/types.ts`), **required not optional**:
an optional field would let a host silently lack it and fall back to plaintext, the exact
failure being prevented.

**The finding worth more than the code.** Three call sites reached
`storage.get/set/remove(TOKEN_KEY)` directly, and `saveStoredToken` had **no callers at
all** — the login flow wrote the credential straight to plaintext while the module meant to
own it sat unused. Swapping only `tokenStore`'s internals would have left login writing
plaintext and reads coming from the Keystore: a broken session, not a leftover copy.
`TOKEN_KEY` is now private to `tokenStore`, which is what stops this recurring.

**Device evidence** (the 74-byte figure is the one that proves encryption rather than
encoding): blob = 46 plaintext + 12 IV + 16 GCM tag = **74 bytes exactly**; entropy
5.93 bits/byte against a 6.21 ceiling for that sample size; no printable run ≥ 8 chars;
decrypt round-trips; cold restart restores the session with no login prompt.

**Migration is deletion, not copying.** Boot purges the plaintext copy before
`ensureSession`, so the student signs in once. A decrypt failure — key invalidated by a
credential change or a restore onto new hardware — reads as a lapsed session: never a
crash, never grounds to look in plaintext.

✅ **The iOS half is written and verified** — `native/capacitor-secure-store`, Keychain via the
Security framework. Round-trip proved on a simulator:
`before=undefined after=probe-value-4711 afterRemove=undefined`.

`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, chosen deliberately: **AfterFirstUnlock**
because the token is read at cold start and by background sync, and WhenUnlocked would fail
those reads on a locked device and prompt a needless sign-in; **ThisDeviceOnly** so the item
never travels in a backup, matching Android's non-exportable Keystore key. No biometric gate,
for the same reason Android does not set `setUserAuthenticationRequired`. Where Android had to
hand-roll AES-256-GCM, iOS writes no cipher code at all — the Keychain *is* the primitive.

## Task 7 — Build and verify on iOS — FIRST BUILD DONE 2026-08-08

**The iOS app has now been built and launched** (simulator, iPhone 17 / iOS 26.5, Xcode 26.6;
SPM, no CocoaPods). It boots to its own UI: safe-area header clear of the notch, bottom nav,
Czech copy.

**Capacitor 8 will not let an app-local iOS plugin talk to JS. This cost four build cycles.**
Full evidence trail in `native/capacitor-secure-store/README.md`; short version:

1. A Swift file in the app target with `@objc(...)` + `CAPBridgedPlugin` compiles, its symbols
   land in the binary, and every call still rejects with `"SecureStore" plugin is not
   implemented on ios`. There is no ObjC-runtime scan any more.
2. `bridge?.registerPluginType(...)` from `capacitorDidLoad()` does **not** fix it. It fills the
   *native* registry but emits no JSExport user script (measured: `WKUserContentController`
   script count 13 → 13, none mentioning SecureStore). JS resolves plugins against
   `window.Capacitor.PluginHeaders` and throws **without ever calling native**.
3. What actually registers a plugin is `packageClassList` in `ios/App/App/capacitor.config.json`
   — which is gitignored AND rewritten by `cap sync`, from installed plugin *packages* only
   (`getPluginFiles` + `findPluginClasses`, `@capacitor/cli/dist/util/iosplugin.js`).
4. So the plugin is a **local package** — `native/capacitor-secure-store`, a `file:` dependency.
   `cap sync` generates the `packageClassList` entry and the `CapApp-SPM` dependency itself, and
   the Xcode project needs **no** modification at all.

`Downloads` and `Eduroam` are app-local Java today. Fine on Android, where
`MainActivity.registerPlugin` runs before bridge init — but their iOS halves must start life as
packages, never as files in the app target.

⚠️ **`Package.swift` has the same symlink trap as `capacitor.settings.gradle`.** With a
symlinked `node_modules`, `cap sync ios` rewrote every path to the resolved target
(`../../../../eduroam-android-native/node_modules/...`) — builds locally, breaks every other
checkout. A real `npm install` in the worktree fixes it; check `git diff` on that file anyway.

⚠️ The plugin's SPM package **and** product name must match the CLI's derivation from the npm
name (`@reis/capacitor-secure-store` → `ReisCapacitorSecureStore`). A mismatch fails at
dependency resolution before any Swift compiles.

### Still owed on iOS

- A login was completed in the simulator and the session works (121 IS requests, no login
  redirects), but it has **not** been repeated from a clean install, so the capture-at-login step
  is proven once rather than reliably.
- The **inverted cookie delivery** is now exercised — iOS's explicit `Cookie` header carried 119
  GETs and 2 POSTs with no unauthenticated response. Still worth a second run to be sure.
- **File delivery** — iOS has no Downloads folder, so `deliverFile` deliberately uses the share
  sheet there (`src/mobile/deliverFile.ts`). Verify that is the right feel.
- Cold-start session restore with a genuine token.
- The **app icon is still the default Capacitor placeholder**; Android got the real logo in #190.
- No iOS analogue of `mobile/backButton.ts`'s sheet-unwind chain; the edge-swipe is all there is.
- eduroam on iOS (`NEHotspotConfiguration`) needs a paid Apple account and a real device.

## Task 8 — Smaller, known items (two of four done)

- ~~**`target="_blank"` escapes to the system browser**~~ ✅ **done.** `mobile/openExternal.ts`
  routes external links through `@capgo/capacitor-inappbrowser`, which shares the native
  cookie jar the transport already seeds — so an IS link opens *authenticated* instead of on
  a login page.

  **The three sites listed here were the wrong three.** Re-deriving against the phone tree
  (`MobileApp` → 5 screens + `SheetHost`) gives five, and `ISBacklink` is not among them —
  it lives in `SubjectFileDrawer`, the desktop tree. The list missed
  `SubjectDrawerSheet.tsx:150` ("Otevřít v IS MENDELU"), `NotificationsSheet.tsx:58` and
  `StudentScreen.tsx:66`.

  Rather than edit each one, `installExternalLinkHandler()` is a document-level capture
  interceptor installed from the Capacitor bootstrap only. It covers every
  `a[target="_blank"]` at once — present, future, and the whole desktop tree, which is what
  the tablet path would need. The two `window.open` sites are converted explicitly, since no
  anchor interceptor can see them.

  Guard worth knowing: it rejects **same-origin** URLs, not merely non-http ones. Capacitor
  serves the app from `http://localhost` on Android, so a protocol-only check would have
  handed the app's own pages to the in-app browser. A test pins this.

  A failed `openWebView` reports via `logError` and nothing else — the interceptor runs from
  a document listener with no React context, so there is no `t` to translate a toast with.
  The tap looks inert in that case; that is a known, deliberate gap.
- ~~**Dead code that is a live trap:**~~ ✅ **done.** `hooks/ui/useFileDownload.ts`,
  `useFileDownload/urlResolver.ts` and `utils/user_id_fetcher.ts` are deleted, along with
  `hooks/ui/index.ts` — the barrel was `useFileDownload`'s only referent and had no
  importers of its own. `useFileDownload` contained every breakage class at once (bare
  `fetch`, `window.open`, `a[download]`, `saveAs`) and was the thing most likely to get
  ported by example.
- **Tablet path is unhandled.** `resolvePhoneViewport` needs touch **and** narrow, so a
  tablet renders the *desktop* tree — which reaches `PdfViewer.tsx:15`
  (`chrome.runtime.getURL` → `ReferenceError`, swallowed at `:61` → permanent spinner) and
  the ZIP path. Decide whether tablets are supported.
- **ZIP stays desktop-only** by product decision. It is already unreachable on phone
  (`SubjectDrawerSheet.tsx:144` passes `selectable={false}`); no work needed, just do not
  "fix" it later.

---

## Found in passing — pre-existing, NOT fixed here

Two real defects surfaced while doing the work above. Neither was introduced by it, both were
deliberately left alone, and both are recorded here because a PR comment is easy to lose.

**1. `isSyncing` can wedge true forever, killing all syncing for the life of the app.**
`syncAllData` (`injector/syncService.ts:52-56`) does:

```js
isSyncing = true;
sendToIframe(Messages.syncUpdate({ ... }));   // ← OUTSIDE the try
try { ... } finally { isSyncing = false; }
```

If `sendToIframe` throws, the flag stays true, the `finally` never runs, and every later
`syncAllData()` hits the `if (isSyncing) return` guard and no-ops — silently, forever. Moving
the flag assignment inside the `try` (or the `sendToIframe` call after it) is the fix. This is
also why `mobile/sessionRecovery.ts` cannot wait unboundedly for an idle sync.

**2. `zaznamnik.ts` never strips non-breaking spaces, despite trying to.** All three
`replace(/ /g, ' ')` calls (lines ~20, ~41, ~49) are ASCII-space → ASCII-space — a no-op. The
intent was clearly ` ` normalisation; the rest of the repo spells it ` `
(`kontrola.ts:32`, `gradeHistory.ts`, `events.ts`). Confirmed present in `45f7228` too, so it
predates the Task 4 work.

**It is currently harmless, and that is why it was not touched.** Running the parsers over all
eight committed fixtures — which contain 30–80 `&nbsp;` each — yields **zero** U+00A0 in parsed
output. Per Parser Rules a change needs a real IS sample proving it correct, and the available
evidence says current behaviour is already correct on every sample we have. It would bite on an
IS page that puts `&nbsp;` inside an arch name or the `nemáte dosud` marker — get such a page
first, then fix it with that fixture.

## Out of scope / tracked elsewhere

| Item | Where |
|---|---|
| Google Drive backup on mobile | **#168** — broken on four axes, all silent |
| Discord webhook in the client bundle | **#163** — needs rotation, which only you can do |
| **ISKAM** | **Recommend declaring out of scope for the first release.** Not a port: WebISKAM is Shibboleth (`alibaba.mendelu.cz/idp`), unlike IS's form POST, so it needs a second login flow through an unspiked SAML redirect chain and a second stored token. `iskam.html` is not even in the mobile bundle. |
| Local notifications, OTA updates | #158's original sequencing, after the above |

## Environment (for whoever picks this up)

```bash
source ~/android-toolchain/env.sh          # JDK 21 (Capacitor 8 requires it), SDK, PATH
npm run build:capacitor && npx cap sync android
cd android && ./gradlew assembleDebug      # NB: check $? directly, not after a pipe
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cz.reis.app/.MainActivity
```

- Android taps are native px on a 1080x2400 screen and are accurate. **iOS Simulator tap
  coordinates proved unreliable** — drive probes from code instead of guessing.
- **Never tap inside a live authenticated IS WebView**; it hit the logout link once.
- 5 test failures are **pre-existing** — missing `.agent/fixtures/**` for the ISKAM
  parsers. `.agent/` is **gitignored**, so a fresh clone never has them and this is
  permanent, not a broken worktree. CI already excludes that directory
  (`vitest run --exclude '**/parsers/iskam/__tests__/**'`), so CI is green — do not
  "fix" these locally.
- **A fresh Claude Code container has no `~/android-toolchain/`** and no Android SDK, so
  Tasks 5–7 cannot be built or verified there at all — only TypeScript work is possible.
  Plan device work for a machine that has the toolchain.

### Two bundle traps this repo will let you walk into

- **A dynamic `import()` inside a content script is inlined, not split.** WXT bundles
  content scripts as one file, so the `await import('@capacitor/*')` idiom used everywhere
  else does NOT keep anything out of `content.js` there. Importing the session-recovery
  prompt from `injector/syncService` took it from **416 kB to 966 kB** on every IS page.
  Check `.output/chrome-mv3/content-scripts/content.js` after any change that reaches an
  `injector/` module from app code.
- **happy-dom's `Headers` overwrites duplicate keys; the spec appends.** A duplicated
  header (see the outlookSync note in Task 4) therefore cannot be reproduced by any test in
  this repo. A green suite proves nothing about header merging.
