# Capacitor — remaining work

Continuation of `2026-08-02-capacitor-shell.md`. That plan's Tasks 1–7 are done; the
shell boots, authenticates, syncs, and downloads files on Android.

This document is the **resume point**. Everything below is either measured or traced to
`file:line` — none of it is speculation. Ordered by what blocks the most.

**Read first:** `docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md` (device
measurements) and `2026-08-02-capacitor-transport-decision.md` (why Model C).

---

## Where it stands

*Updated 2026-08-04, after PR #179 (`1ad5d030`) and PR #181 (`c9e6160f`).*

| Area | State |
|---|---|
| Shell: boot, login, session restore, back button | **Done**, device-verified on Android |
| Transport (`CapacitorHttp`, per-platform cookie) | **Done** — GET **and POST**, plus raw bytes |
| Sync (14 endpoints, ~236 requests) | **Done** via postMessage loopback — the zaznamnik hole is now closed too (Task 4) |
| File download → Downloads + notification | **Done**, device-verified |
| Duplicate file listings | **Fixed** (also fixes the extension) |
| Study documents (Task 1/2) | **Done**, device-verified — PR #179 |
| eduroam cert fetch (Task 3 + eduroam half of Task 4) | **Merged unverified** — PR #181, see Task 3 |
| iOS app | **Never built** — only the throwaway spike ran there |
| ISKAM, Drive, native Wi-Fi | **Broken** — see below |

**The owed device check has grown.** PR #181 merged on green unit tests with the Android
verification still undone — nothing has ever exercised POST on real hardware. The Task 4
migrations since then are in the same position: unit-tested, never run on a handset. When
a cable is next to hand, do them in one pass — eduroam (Task 3), then confirm continuous
assessment, search, submissions, practice tests and the study check actually populate on
the phone.

**~~"Sync is done" has one hole.~~ Closed.** `syncZaznamnik` runs *inside* the same sync
(`injector/syncService.ts:381`) and used to reach IS through a bare `fetch`, so it was
CORS-blocked on Capacitor: continuous assessment — průběžné hodnocení and practice-test
scores — silently never arrived on the phone while everything around it did. It now goes
through `fetchWithAuth`. **Unverified on a device**, like everything else since PR #181.

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

## Task 4 — Bare `fetch` call sites that bypass the transport (eduroam done)

These call `fetch(...)` directly instead of `fetchWithAuth`, so they are CORS-blocked on
Capacitor:

**The list below was wrong twice before it was right.** It originally held 5 files and a
line dismissing everything else as CDN/Google/Supabase; two review rounds on PR #182 found
more each time. Do not trust it as folklore — **re-derive it** and diff against this table:

```bash
grep -rn "\bfetch(" src/ --include='*.ts' --include='*.tsx' \
  | grep -v "__tests__\|\.test\.\|fetchWithAuth(\|fetchViaProxy(\|fetchJsonViaProxy(\|fetchAuthedBytes(\|fetchIsBinary(\|fetchViaCapacitor("
```

Grepping for `mendelu` on the same line as `fetch(` is what missed them — the URL is a
constant or a variable at most of these sites.

| File | Line | Reaches mobile via | State |
|---|---|---|---|
| `src/api/eduroam.ts` | ~~31, 37, 55~~ | eduroam sheet | ✅ done, PR #181 |
| `src/api/zaznamnik.ts` | ~~186 (two in one `Promise.all`)~~ | **sync** — continuous assessment | ✅ done |
| `src/api/search/searchService.ts` | ~~22, 38, 57, 80, 102~~ | search + `PersonHoverCard` | ✅ done |
| `src/api/cvicneTests.ts` | ~~23~~ | subject detail | ✅ done |
| `src/api/odevzdavarny.ts` | ~~56~~ | submissions | ✅ done |
| `src/api/kontrola.ts` | ~~17~~ | study check | ✅ done |
| `src/utils/serverTime.ts` | 29 | tablet-only path | **deliberately left** — see below |
| ~~`src/hooks/ui/useFileActions.ts`~~ | — | — | **not a target — the row was wrong**, see below |
| `src/hooks/ui/useFileDownload.ts` + `useFileDownload/urlResolver.ts` | 19, 45 / 16 | nothing — dead code, see Task 8 | ✅ deleted |
| `src/utils/user_id_fetcher.ts` | 7 | nothing — **orphaned**, zero importers | ✅ deleted |

**Correction — `useFileActions` was never broken on mobile.** This plan called it "the
sharpest of these"; that was wrong, and re-checking cost less than the migration would
have. All three student-reachable functions (`openFile`, `openPdfInline`,
`downloadSingle`) have had an `isNativeHost()` branch that returns *before* the bare fetch
since **#169**, the original shell PR — which predates this document. The two remaining
bare fetches are inside `downloadZip`, and ZIP is desktop-only by product decision and
already unreachable on phone (`SubjectDrawerSheet.tsx` passes `selectable={false}` and
destructures only `openFile`/`downloadSingle`). Nothing to do here.

**`serverTime` deliberately left as a bare fetch.** It is the one row that is not a
mechanical swap: it issues a **HEAD** request and reads the `Date` *response* header.
`buildCapacitorRequestOptions` dispatches GET and POST only, and the native bridge would
have to forward response headers for the read to survive. That is real transport work for
a **tablet-only** path whose product status is itself undecided (Task 8). Revisit it with
the tablet decision, not before.

**The search migration needed care, not a swap.** All four search POSTs passed their own
`'Content-Type': 'application/x-www-form-urlencoded'`. Handing that to `fetchWithAuth`
reproduces the defect found in eduroam and still live in `outlookSync`: DEFAULT_HEADERS
carries a lowercase `content-type`, the caller's capitalised one survives the object
spread as a second key, and `Headers` **appends** — IS then parses no body and returns an
ok-looking page, so search silently yields zero results with nothing reporting an error.
The caller headers were dropped; `searchService.test.ts` now pins one content-type on the
wire, counting keys on the object handed to `fetch` rather than reading them back through
`new Headers` (happy-dom replaces duplicates, so an assertion routed through it would pass
while the wire stayed malformed). **That is three sites with the same defect — treat a
caller-supplied `Content-Type` as a bug wherever it meets `fetchWithAuth`.**

⚠️ **Behaviour change to know about:** `fetchWithAuth` redirects to the IS login page on
401/403. These call sites previously swallowed that (`return null`). The redirect only
fires on the *direct* branch — the iframe goes through the proxy and Capacitor goes
native — so in practice it affects the dev webapp and the content script, where every
other sync endpoint already behaves this way.

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

**Adjacent, found while doing eduroam:** `src/api/outlookSync.ts:73` passes its own
`Content-Type` into `fetchWithAuth`, which already sets a lowercase one — both keys
survive the object spread and `Headers` *appends*, so IS receives the value twice, parses
no body, and yet `response.ok` is true and the UI reports success. Extension-only; the
Capacitor path forwards caller headers alone and is unaffected.

## Task 5 — eduroam native one-tap (#159)

**Nothing exists in the product.** Verified: `android/app/src/main/java/cz/reis/app/`
holds only `MainActivity.java` and `DownloadsPlugin.java`; the manifest declares no
`ACCESS_WIFI_STATE` / `CHANGE_WIFI_STATE`; there is no iOS hotspot code or entitlement.
Only the throwaway spike proved the approach.

~~Today the sheet is 100% non-functional and fails at the first network call~~ — **the
network half is fixed** (Task 3 / PR #181). `fetchEduroamPassword` is no longer a
CORS-blocked bare `fetch`, so the sheet should stop firing a telemetry report on every
open and the password should render. **Unconfirmed on a device** — that is the owed check
in Task 3, and it is the first thing to do here, because everything below assumes the
cert material actually arrives.

What remains is the **native Wi-Fi configuration** — nothing joins a network yet.

Task 3 (POST + bytes) is now **done**, so this is unblocked. Then:

1. Android plugin `configure({p12Base64, passphrase, caDerBase64, login})` — the spike's
   `EduroamProbePlugin` is the working reference. **`setWifiEnterpriseConfig()` does not
   exist**; use `setWpa2EnterpriseConfig`. Min API 30.
2. Manifest permissions.
3. `EduroamTarget` gains a `native` branch, bypassing `putTransfer` / QR / `saveAs`
   entirely — and `EduroamSheet.tsx:88` must stop rendering a QR on the very device being
   configured (it is a desktop→phone artifact; unscannable here).
4. iOS `NEHotspotEAPSettings` + entitlement — **still unverified** whether iOS accepts
   MENDELU's self-signed root.
5. Cert expiry is 366 days and silent; renewal is a POST (an IS write) and must stay
   student-initiated.

## Task 6 — Secure storage for `UISAuth`

`@capacitor/preferences` is UserDefaults / SharedPreferences, **not** Keychain/Keystore,
and `UISAuth` is a live credential (`src/platform/tokenStore.ts:8-12` says so). Acceptable
for a debug build.

> **This is the one item with a security bar rather than a feature bar. It must land
> before any public release.**

## Task 7 — Build and verify on iOS

The app has never been built for iOS; only the spike ran there. Everything platform-specific
should be re-checked, in particular:

- The **inverted cookie delivery** (iOS needs the explicit header, Android the native jar).
- **File delivery** — iOS has no Downloads folder, so `deliverFile` deliberately uses the
  share sheet there (`src/mobile/deliverFile.ts`). Verify that is the right feel.
- Cold-start session restore.

## Task 8 — Smaller, known items

- **`target="_blank"` escapes to the system browser** (no IS session): the "Žádost na
  studijní oddělení" row (`DocsSheet.tsx:84-94`), `ISBacklink`, and the ISKAM card
  (`ShortcutGrid.tsx:53-66`). Present these in the in-app browser instead.
- ~~**Dead code that is a live trap**~~ **✅ deleted.** `useFileDownload.ts` (every
  breakage class at once: bare `fetch`, `window.open`, `a[download]`, `saveAs`),
  `useFileDownload/urlResolver.ts`, and the orphaned `src/utils/user_id_fetcher.ts` are
  gone. **Only that orphaned utility file** — the live `fetchUserId()` in `src/api/user.ts`
  is a different thing entirely and stays; it already uses `fetchWithAuth` against the same
  URL. `src/hooks/ui/index.ts` went with them: it was `useFileDownload`'s only importer,
  **nothing imported the barrel itself**, and re-export files are banned by the iron rules
  in CLAUDE.md. The three surviving hooks it re-exported are imported directly.
- **Tablet path is unhandled.** `resolvePhoneViewport` needs touch **and** narrow, so a
  tablet renders the *desktop* tree — which reaches `PdfViewer.tsx:15`
  (`chrome.runtime.getURL` → `ReferenceError`, swallowed at `:61` → permanent spinner) and
  the ZIP path. Decide whether tablets are supported.
- **ZIP stays desktop-only** by product decision. It is already unreachable on phone
  (`SubjectDrawerSheet.tsx:144` passes `selectable={false}`); no work needed, just do not
  "fix" it later.

---

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
  parsers, absent from this worktree.
