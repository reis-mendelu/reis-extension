# Capacitor — remaining work

Continuation of `2026-08-02-capacitor-shell.md`. That plan's Tasks 1–7 are done; the
shell boots, authenticates, syncs, and downloads files on Android.

This document is the **resume point**. Everything below is either measured or traced to
`file:line` — none of it is speculation. Ordered by what blocks the most.

**Read first:** `docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md` (device
measurements) and `2026-08-02-capacitor-transport-decision.md` (why Model C).

---

## Where it stands

| Area | State |
|---|---|
| Shell: boot, login, session restore, back button | **Done**, device-verified on Android |
| Transport (`CapacitorHttp`, per-platform cookie) | **Done** — GET only |
| Sync (14 endpoints, ~236 requests) | **Done** via postMessage loopback |
| File download → Downloads + notification | **Done**, device-verified |
| Duplicate file listings | **Fixed** (also fixes the extension) |
| iOS app | **Never built** — only the throwaway spike ran there |
| Study documents, eduroam, ISKAM, Drive | **Broken** — see below |

---

## Task 1 — The `REIS_ACTION` loopback (highest value, unblocks the most)

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

## Task 2 — Exam refresh after a write

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

## Task 3 — Transport gaps: POST and raw bytes

The Capacitor branch (`src/api/client.ts:38-46`) calls **only** `CapacitorHttp.get` and
drops `options.method` / `options.body`. Two shapes are missing:

- **POST** — needed for eduroam cert generation (`src/api/eduroam.ts:55`) and any future
  write that is not a GET. Nothing exercises it today, which is why it has not surfaced.
- **Raw bytes** — `fetchIsBinary` (`src/api/capacitorBinary.ts:57`) returns a `Blob`;
  eduroam needs `Uint8Array`. Note `capacitorTransport.ts:86`'s `logout.pl` auth check
  must **not** be applied to binary bodies — routing eduroam through `fetchWithAuth`
  unchanged would fail *harder*, not softer.

## Task 4 — Bare `fetch` call sites that bypass the transport

These call `fetch(...)` directly instead of `fetchWithAuth`, so they are CORS-blocked on
Capacitor:

| File | Line |
|---|---|
| `src/api/cvicneTests.ts` | 23 |
| `src/api/odevzdavarny.ts` | 56 |
| `src/api/kontrola.ts` | 17 |
| `src/api/eduroam.ts` | 31, 37, 55 |
| `src/utils/serverTime.ts` | 29 (tablet-only path) |

⚠️ Not a blind sed: `fetchWithAuth` also imposes `DEFAULT_HEADERS` and a 401/403 login
redirect, which changes **extension** behaviour. Check each call site.

Other bare fetches in `src/api/` target the CDN, Google or Supabase and are fine.

## Task 5 — eduroam native one-tap (#159)

**Nothing exists in the product.** Verified: `android/app/src/main/java/cz/reis/app/`
holds only `MainActivity.java` and `DownloadsPlugin.java`; the manifest declares no
`ACCESS_WIFI_STATE` / `CHANGE_WIFI_STATE`; there is no iOS hotspot code or entitlement.
Only the throwaway spike proved the approach.

Today the sheet is **100% non-functional and fails at the first network call** — opening
it auto-fires a CORS-blocked `fetchEduroamPassword()` whose error is swallowed into
`logError`, so row 1 sits on a placeholder forever **and a telemetry report fires on every
sheet open before the student touches anything**.

Depends on Task 3 (POST + bytes). Then:

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
