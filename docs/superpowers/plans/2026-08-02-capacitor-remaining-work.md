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
| Sync (14 endpoints, ~236 requests) | **Done** via postMessage loopback |
| File download → Downloads + notification | **Done**, device-verified |
| Duplicate file listings | **Fixed** (also fixes the extension) |
| Study documents (Task 1/2) | **Done**, device-verified — PR #179 |
| eduroam cert fetch (Task 3 + eduroam half of Task 4) | **Merged unverified** — PR #181, see Task 3 |
| iOS app | **Never built** — only the throwaway spike ran there |
| ISKAM, Drive, native Wi-Fi | **Broken** — see below |

**The one owed check:** PR #181 merged on green unit tests with the Android device
verification still undone. Nothing has ever exercised POST on real hardware. Do that
before treating eduroam on mobile as working — details in Task 3.

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

| File | Line | State |
|---|---|---|
| `src/api/eduroam.ts` | ~~31, 37, 55~~ | ✅ done in PR #181 — all four gone |
| `src/api/cvicneTests.ts` | 23 | open |
| `src/api/odevzdavarny.ts` | 56 | open |
| `src/api/kontrola.ts` | 17 | open |
| `src/utils/serverTime.ts` | 29 (tablet-only path) | open |
| `src/api/zaznamnik.ts` | 186 (two, in one `Promise.all`) | open — **missing from the original list** |
| `src/api/search/searchService.ts` | 57, 80, 102 | open — **missing from the original list** |

⚠️ Not a blind sed: `fetchWithAuth` also imposes `DEFAULT_HEADERS` and a 401/403 login
redirect, which changes **extension** behaviour. Check each call site. The remaining ones
are independent of each other, so they need not land together.

The last two rows were **absent from this table until 2026-08-04** — the line below used to
claim every other bare fetch was a CDN/Google/Supabase call, which was wrong, and anyone
working the list would have skipped them. They matter: `zaznamnik.ts` is called from the
**sync** path (`src/services/sync/syncZaznamnik.ts`), and `searchService.ts` backs search
and the person hover card. Both are reachable on mobile and both are CORS-blocked there.

These work on the extension only because a Chrome extension's `fetch` bypasses CORS for
hosts in `host_permissions` — a privilege the Capacitor app does not have. That is the
whole reason this task exists, and it is why "it works in the extension" proves nothing here.

Genuinely fine, for the record: `iskam/skmDocuments.ts:5` (ISKAM, out of scope),
`injector/menuScraper.ts:132` (content-script-only — imported solely by `injector/sniper.ts`,
which never runs on Capacitor), and the `CDN_BASE_URL` / Google / Supabase calls.

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
- **Dead code that is a live trap:** `src/hooks/ui/useFileDownload.ts` has no consumers
  but contains every breakage class at once (bare `fetch`, `window.open`, `a[download]`,
  `saveAs`). Delete it before someone ports by example.
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
