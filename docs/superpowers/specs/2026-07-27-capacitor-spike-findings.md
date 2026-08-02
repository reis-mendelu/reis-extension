# Capacitor spike — findings

Results of the day-one device tests from #158. Each answer is measured, not inferred.

## Environment

| Component | Version |
|---|---|
| Capacitor CLI | 8.5.0 |
| @capacitor/core | 8.5.0 |
| @capacitor/ios | 8.5.0 |
| @capacitor/android | 8.5.0 |
| @capgo/capacitor-inappbrowser | 8.13.2 (post-8.6.0 — on the breaking-change side of the proxy-handling change) |
| Xcode / iOS Simulator | Xcode 26.6 (build 17F113), iOS 26.5 Simulator runtime, iPhone 17 |
| Android emulator API level | **API 35** (Pixel 7, Android 15, arm64) |
| JDK | **Temurin 21.0.12** — Capacitor 8 requires 21; JDK 17 fails Gradle with `matching languageVersion=21` |

## Results

| # | Question | Answer | Evidence |
|---|---|---|---|
| 0 | Does `preShowScript` injection run on IS? | **YES — at documentStart, on BOTH platforms** | Green banner `REIS INJECTION OK — readyState at inject: loading` on the IS login page, iOS **and** Android |
| 1 | Does iOS WKWebView keep `UISAuth` across app kill? | **NO — cookie is lost** | live session before kill → `ABSENT` after SIGKILL + relaunch |
| 1b | Can the cookie be RESTORED into the WebView? | **YES — hybrid** | `headers` + `document.cookie` at documentStart; authenticated and survives navigation |
| 2 | Does Android WebView keep `UISAuth` across app kill? | **NO — lost too** | `UISAuth` len 46 before `force-stop` → `keys: (none)` / `ABSENT` after, PID 5175→5414 |
| 3 | Does blob + `a[download]` save a file? | **NO — and it fails SILENTLY** | Android: blob 1,620,758 B fetched, `a.click()` ran, **no file anywhere**, no error |
| 4 | Does `ACTION_WIFI_ADD_NETWORKS` accept an EAP-TLS config? | **YES** | `resultCode -1 (RESULT_OK)`, `perNetwork 0 (SUCCESS)`; saved as netId=1, `TYPE_EAP` |

## Consequences for #158

**The architecture holds.** The load-bearing assumption — that reIS can be injected
into IS inside a Capacitor WebView at document start, on both platforms — is measured,
not inferred. Nothing found here invalidates the port.

Four things changed as a result of measuring:

1. **Session restore is mandatory on both platforms** (tests 1 + 2). It was hoped to be
   iOS-only, or avoidable via `persistWebViewData`. It is neither. `UISAuth` is a
   session cookie and both engines drop it on app kill.
2. **But restore is solved, and it is one mechanism for both** (test 1b). The hybrid —
   `headers: {Cookie}` for request #1, `document.cookie` at documentStart for the rest —
   works identically on iOS and Android. No native plugin, no `setCookie` API, and the
   `outboundProxyRules` workaround listed in §A is **not needed**.
3. **`@capacitor/filesystem` + `@capacitor/share` moved from optional to required**
   (test 3) — and the failure they prevent is *silent*, which makes it a shipping risk
   rather than a papercut.
4. **`urlChangeEvent` re-injection may be deletable** (test 0b) — `preShowScript`
   re-runs on every navigation in 8.13.2. Confirm once more on a deep navigation before
   removing it from the design.

**Still unproven and needing real hardware, not more spike work:** eduroam
*association* on campus, the iOS `NEHotspotEAPSettings` self-signed-root question, and
the iOS twin of the download probe (expected to fail like Android).

One thing this spike did **not** test: how a restored session behaves over days, and
whether IS ever rotates `UISAuth` mid-session. The audit showed no rotation across
requests, and no `Set-Cookie` appears on authenticated requests — but that is not the
same as observing it across the full inactivity window.

---

## Confirmed on device (iOS 26.5 Simulator, iPhone 17)

### Test 0 — injection: **PASS, at document start**

`preShowScript` + `preShowScriptInjectionTime: 'documentStart'` runs against the real
IS page. The probe banner reports `readyState at inject: loading` — i.e. it executes
*before* IS parses its own document, matching what the extension gets today from
`runAt: "document_start"`.

**This was the most fundamental gate in #158 and it holds.**

### Test 0b — injection survives navigation: **RE-INJECTS AUTOMATICALLY**

The plan predicted the banner would disappear after navigating to another IS page,
which would have made `urlChangeEvent` → `executeScript()` re-injection mandatory.
It does **not** disappear. Navigating from the login page to *"First log in to UIS
instructions"* (a full page load — IS is a classic multi-page Perl app, not an SPA)
still shows the banner. A `<div>` cannot survive document replacement, so the script
re-ran.

> **Consequence for #158:** `preShowScript` appears to apply to every navigation in
> `@capgo/capacitor-inappbrowser` 8.13.2, not just the initial load. The
> `urlChangeEvent` re-injection step may be unnecessary. Worth one more confirmation
> across a deeper navigation before deleting it from the design.

### Real IS renders inside `openWebView`: **PASS**

The login form, faculty navigation and eID (NIA) option all render normally. No
framing refusal, no WAF challenge, no User-Agent block. Task 2's fatal-if-false
check passes.

### API constraint discovered

`openWebView` **throws** without `isPresentAfterPageLoad: true` when `preShowScript`
is used:

```
Error: preShowScript requires isPresentAfterPageLoad to be true
```

Confirmed in the shipped `.d.ts` (`OpenWebViewOptions`). The architecture in #158
specifies `preShowScript` + `documentStart`, so **`isPresentAfterPageLoad: true` is
mandatory**, and the WebView is presented only after page load. That is arguably
desirable — it mirrors the extension hiding the page until reIS is ready
(`src/entrypoints/content.ts` sets `visibility: hidden` at document start).

### Build notes for anyone following the plan

- **Capacitor 8 uses SPM, not CocoaPods.** There is no `App.xcworkspace`; build with
  `-project ios/App/App.xcodeproj`.
- **The first build takes >10 minutes** resolving SPM packages, with no incremental
  output. It is not hung.
- `npx cap add android` requires a JDK — and specifically **JDK 21**. JDK 17 gets
  through `cap add` but fails at Gradle with `Cannot find a Java installation …
  matching languageVersion=21`. The first Gradle sync takes ~5 minutes.
- A duplicate simulator runtime disk image will block device creation with
  `Invalid runtime`. Prefer Xcode's Components UI over `simctl runtime delete`
  — deleting it destroyed the 8.5 GB download once and it had to be refetched.
- Homebrew was unusable on this machine (`/opt/homebrew` not user-owned, needs
  `sudo chown`). The whole Android toolchain was installed **user-space, no sudo**:
  JDK under `~/android-toolchain/`, SDK under `~/Library/Android/sdk`, with an
  `env.sh` exporting `JAVA_HOME` / `ANDROID_HOME` / `PATH`.

### Android run recipe

```bash
source ~/android-toolchain/env.sh
cd <spike>/android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cz.reis.spike/.MainActivity
adb shell input tap <x> <y>          # screen is 1080x2400, native px, no scaling
adb exec-out screencap -p > shot.png
```

To kill for a cold-start test: `adb shell am force-stop cz.reis.spike`, and confirm it
was genuine with `adb shell pidof cz.reis.spike` before and after. On iOS the equivalent
is `xcrun simctl terminate`; simulator screenshots need a **~2.287** divisor to convert
image pixels to tap points, whereas Android needs none.

> **Do not tap inside a live authenticated IS WebView to navigate.** Doing so hit the
> logout link once and ended the session mid-test. Drive process kills from the host
> (`adb` / `simctl`) and get URLs from outside the WebView instead.

### Incidental finding — IS documents its session timeout

The *"First log in to UIS instructions"* page states:

> "The login form also contains setting of the login validity period, which is a
> minimal period of inactivity after which you will be logged out from the system.
> Implicitly, this period is set to one day."

This **corrects** the audit's earlier conclusion of a ~7-day absolute lifetime. IS
uses a **sliding inactivity window, default 1 day, settable on the login form**. See
the correction in `2026-07-26-capacitor-assumption-audit.md` §C1.

## Still open

| Test | Blocked on |
|---|---|
| ~~1 — iOS cookie survival across app kill~~ | **done** — fails, restore built and proven |
| ~~2 — Android cookie survival~~ | **done** — fails the same way |
| ~~3 — file download~~ | **done** on Android — silent no-op; iOS twin not run |
| ~~4 — `ACTION_WIFI_ADD_NETWORKS` EAP-TLS (#159)~~ | **done** — accepted, see below |

Everything the spike set out to answer is answered. What remains is **on-device
confirmation on real hardware**, not open design questions:

| Remaining | Why it needs a real device |
|---|---|
| eduroam **association** on campus | needs a MENDELU AP in range |
| iOS `NEHotspotEAPSettings` with a self-signed root | needs the HotspotConfiguration entitlement + a paid account |
| iOS download probe | expected to fail like Android; not yet measured |

### Bonus experiment — can injection make IS phone-native? **NO, not via viewport meta**

Prompted by the observation that the IS login page renders small and requires
pinch/scroll on a phone. Since `preShowScript` demonstrably runs at documentStart,
the obvious idea was to inject a viewport meta tag and let IS reflow.

**Tested on device. It made rendering worse.**

```
VIEWPORT: was (none) → now width=device-width, initial-scale=1
```

- IS ships **no viewport meta at all** — confirmed, not assumed.
- Without one, WKWebView defaults to a ~980px viewport and **shrinks-to-fit**, which
  is why the login page renders fully visible (small, but complete and legible).
- Forcing `width=device-width` gives a 402px viewport that IS's **fixed-width
  desktop layout (~1000px tables)** simply overflows. The login form is pushed
  off-screen and content is clipped horizontally.

**Conclusion:** a viewport meta cannot reflow a fixed-width layout. Making IS
phone-native by injection is possible but means shipping **responsive CSS overrides
for IS's own layout, page by page** — a feature project with real maintenance
exposure against a system whose HTML already churns enough to keep our parsers busy
(~4 commits/week). It is not a one-line win.

The probe is retained at `src/probes/viewport.ts` in the spike, disabled, with the
negative result recorded at the top of the file so it is not retried blindly.

> **Worth separating two different ambitions here.** "Wrap IS so reIS works on a
> phone" (this issue) is verified and on track. "Make *IS itself* usable on a phone"
> is a much larger, separate undertaking — and the fact that reIS *can* inject at
> documentStart makes it technically possible, which is exactly why it should be
> scoped deliberately rather than drifting into the port.

---

## Test 1 — iOS cookie survival across app kill: **FAILS. Restore is mandatory.**

The headline question of this spike, answered.

| Step | `Read cookies` output |
|---|---|
| Logged in, WebView closed | `keys: UISAuth` / `UISAuth: 6faz7v…IjiQ (len 48)` |
| After `simctl terminate` + relaunch (**no login**) | `keys: (none)` / **`UISAuth: ABSENT`** |

Method: `xcrun simctl terminate` SIGKILLs the app process — equivalent to swiping it
away in the app switcher, and it resets `WKProcessPool`. Kill was verified
(`launchctl list` → gone) and the relaunch got a **new PID** (87575 → 37389), so this
was a genuine cold start, not a resume.

**Confound checked and closed:** the spike never passed `persistWebViewData`, so it
could have been disabled. It is not — the shipped `.d.ts` declares `@default true`
(since 8.6.36). Persistence was **on**, and the cookie was lost anyway.

That is the expected behaviour once stated plainly: `UISAuth` is a **session cookie
with no `Expires`**. "Session" means until the browsing session ends, and killing the
app ends it. `persistWebViewData` persists cache/localStorage/IndexedDB — it does not
promote a session cookie to a persistent one.

### Consequences

- **D5 CONFIRMED.** "`persistWebViewData: true` means the session survives app restart"
  was too optimistic, exactly as suspected.
- **D3's optimistic reading is dead for iOS.** "iOS may not need cookie restore" is false.
- **Session restore is REQUIRED, not conditional.** The Keychain/Keystore workstream in
  #158 is real work and cannot be cancelled. Plan 4 stays.
- Combined with the ~1-day sliding inactivity window, the UX target is: restore the
  cookie on cold start so the student stays logged in **as long as they use the app
  within the inactivity window**, instead of re-authenticating on every app kill.
- The server side is already proven to accept this: the audit showed `UISAuth` survives
  process death, a UA swap, and total attribute loss, and that only `name+value+domain+path`
  is needed. `getCookies({includeHttpOnly:true})` is verified working here. So restore is
  **known-feasible** — it just has to be built.

### Still open on Android

Test 2 (Android cookie survival) remains untested — no Android toolchain installed.
Android WebView is Chromium and its cookie store is process-independent, so it may
well survive where iOS does not. **Do not assume it; it is now the only remaining
platform question that could reduce scope.**

---

## Cookie RESTORE — solved. The hybrid works and survives navigation.

Test 1 proved iOS *loses* the cookie. This proves we can *put it back*. Tested against
a real, live IS session token (entered at runtime via `window.prompt`; never committed).

`@capgo/capacitor-inappbrowser` has **no `setCookie` API**, so three approaches were
tried on device:

| Approach | Load #1 | After navigating | Verdict |
|---|---|---|---|
| **A. `headers: { Cookie }`** | ✅ authenticated | ❌ **back to login page** | Insufficient alone |
| **B. `document.cookie` + `location.replace`** | — | — | ❌ reload aborts the load that `isPresentAfterPageLoad` waits for |
| **C. HYBRID — `headers` + `document.cookie` at documentStart, no reload** | ✅ authenticated | ✅ **still authenticated** | ✅ **WORKS** |

The discriminator is the probe's `cookieVisible` field:

- Approach A → `AUTHED: yes | cookieVisible: false` — the header authenticated the
  request but **nothing entered WKWebView's cookie jar**, so the next navigation was
  anonymous.
- Approach C → `AUTHED: yes | cookieVisible: true` — a real cookie is in the jar, and
  it rides every subsequent request.

### Why the hybrid is necessary rather than belt-and-braces

Each half fixes what the other cannot:

- The **first request** leaves before any script can run, so only a `Cookie` **header**
  can authenticate it.
- **Every later request** needs a cookie in the jar, which only **`document.cookie`**
  can put there.

`UISAuth` is `HttpOnly`, but HttpOnly only blocks JS from *reading* a cookie. On a
fresh WebView where no such cookie exists, JS may *create* one with that name, and the
server neither knows nor cares that the client-side copy lacks the flag.

This also depends on the already-confirmed fact that `preShowScript` runs at
**documentStart** — approach C is only possible because injection lands before the page
does anything.

### What this settles

- **Session restore is feasible on iOS with no native plugin and no `setCookie` API.**
  §A listed `outboundProxyRules` + `addProxyHandler` as the alternative workaround —
  **not needed.**
- Combined with test 1, the full cycle is proven end-to-end in the WebView:
  `getCookies` → (store) → app killed → relaunch → hybrid restore → authenticated and
  navigable.

### Not yet proven

- **Keychain / secure storage persistence.** The store→retrieve step was simulated by
  pasting the token by hand. Persisting it across an app kill is mundane KV work
  (`@capacitor/preferences` is UserDefaults, *not* Keychain — a secure-storage plugin
  is required for a credential), but it has not been exercised here.
- Long-session behaviour of a restored session, and whether IS ever rotates `UISAuth`
  mid-session (the audit showed no rotation across requests, but not across days).

### Corrections made during this test

- I twice reported "openWebView resolved but the WebView never presented". **Wrong** —
  `openWebView` resolves on *presentation*, and the screenshots were taken before the
  WebView animated in. Approaches B and C had both presented. Approach B's real defect
  is narrower than first stated: the reload conflicts with `isPresentAfterPageLoad`.

---

## Test 4 — eduroam EAP-TLS via `ACTION_WIFI_ADD_NETWORKS`: **ACCEPTED**

The one open item in #159, answered on Android 15 / API 35 with **real MENDELU cert
material** (the student's own `.p12` + the MENDELU root CA, fetched from IS without
generating a new certificate — generation is one of only three IS write paths and
was deliberately avoided).

| Signal | Value |
|---|---|
| `resultCode` | `-1` = `RESULT_OK` |
| per-network result | `0` = `ADD_WIFI_RESULT_SUCCESS` |
| Saved as | `netId=1`, `configKey="eduroam"WPA_EAP`, `networkType=TYPE_EAP` |
| Saved-network count | `numSavedNetworks=2` (was 1) |
| Creator | `networkCreator=CREATOR_USER` |

A system dialog appeared — *"Save this network? reIS Spike wants to save a network to
your phone / eduroam"* — with Cancel/Save. One tap on Save, and the config was written.

### The self-signed root CA is genuinely pinned

This was the real risk: that Android would either reject MENDELU's self-signed root or
silently degrade to "trust any server". Neither happened. From `dumpsys wifi`:

```
identity "xholek1@mendelu.cz"
domain_suffix_match "mendelu.cz"
ca_cert "keystore://CACERT_"eduroam"_WPA_EAPIEEE8021X_TLS_NULL_0"
client_cert "keystore://USRCERT_"eduroam"_WPA_EAPIEEE8021X_TLS_NULL"
key_id "USRPKEY_"eduroam"_WPA_EAPIEEE8021X_TLS_NULL"
engine 1
engine_id "keystore"
user_approve_no_ca_cert: false
```

Every field survived exactly as configured, and `mEapMethod=1` (TLS), `mOcspType=0`
(OCSP off) match MENDELU's own guide. **`user_approve_no_ca_cert: false` is the
important one** — Android did not fall back to the "no CA certificate" escape hatch;
the private key and both certificates went into the **system keystore**, and the
server cert will be validated against the pinned root with a `mendelu.cz` domain-suffix
check.

### API correction — the plan's code did not compile

`WifiNetworkSuggestion.Builder` has **no** `setWifiEnterpriseConfig()`. Verified
against `android-35` (`javap`), the only enterprise setters are:

```
setWpa2EnterpriseConfig · setWpa3EnterpriseConfig
setWpa3EnterpriseStandardModeConfig · setWpa3Enterprise192BitModeConfig
setWapiEnterpriseConfig
```

**The caller must commit to a WPA generation.** eduroam at MENDELU is WPA2-Enterprise,
so `setWpa2EnterpriseConfig` is correct — deprecated since API 33 but still the only
WPA2 path. Getting this wrong is a compile error, not a runtime surprise, so it is
cheap; it just needs to be in the implementation issue.

The probe is written in **Java, not Kotlin** as the plan specified: the Capacitor
Android app module ships no Kotlin Gradle plugin, and adding one is avoidable risk.

### What is still NOT proven

**Accepting a config is not the same as connecting to the network.** The emulator has
no eduroam AP in range, and it showed exactly that — the framework immediately tried
to connect and reported:

```
FAILURE_NETWORK_NOT_FOUND, wifiState=WIFI_ASSOCIATED, mEapMethod=1
```

That failure is the *expected* off-campus result and says nothing about whether the
handshake works. **Proving association requires a real phone in range of a MENDELU
AP.** That is a separate on-campus check, and it is the last thing standing between
#159 and "verified end to end".

### Consequences for #159

- The **`ACTION_WIFI_ADD_NETWORKS` approach is confirmed.** No fallback to
  `addNetworkSuggestions` (with its 24-hour disconnect penalty) is needed.
- The result is a **real, user-visible, user-deletable saved network** — the property
  that made this API the right choice over the Suggestion API.
- **geteduroam is not needed on Android**, and its failure mode (disabling a working
  config after failing to resolve MENDELU in eduroam discovery) is avoided entirely.
- Required manifest permissions: `ACCESS_WIFI_STATE`, `CHANGE_WIFI_STATE`.
- Minimum API is **30** for this intent; below that the app must fall back or refuse.

---

## Test 0 on Android: **PASS — injection is cross-platform**

Same probe, Android 15 / API 35 emulator, same result: the IS login page renders in
`openWebView` and the green banner reports `readyState at inject: loading`.

Two things this settles, both previously only verified on iOS:

- **`preShowScript` + `documentStart` is not an iOS-only capability.** The single
  biggest architectural gate in #158 now holds on both platforms.
- **IS renders in Android's WebView too** — no framing refusal, no UA block, no WAF
  challenge. The fatal-if-false check passes on both.

Incidentally, Android's WebView shrinks-to-fit the same way WKWebView does: the login
page is small but complete and legible. This is consistent with the negative viewport
finding above — IS ships no viewport meta, and both engines cope by zooming out.

---

## Test 2 — Android cookie survival across app kill: **ALSO FAILS**

The hoped-for scope reduction does **not** materialise. Android's WebView is Chromium
and its cookie store is process-independent, so it was reasonable to expect `UISAuth`
to survive where WKWebView lost it. It does not.

| Step | `Read cookies` output |
|---|---|
| After hybrid restore, WebView closed | `keys: UISAuth` / `UISAuth: 6NSqqy…3bRQ (len 46)` |
| After `am force-stop` + relaunch | `keys: (none)` / **`UISAuth: ABSENT`** |

The kill was verified genuine, not a resume: PID **5175 → (gone) → 5414**.

The reason is the same on both platforms and has nothing to do with the engine:
**`UISAuth` has no `Expires`, so it is a session cookie**, and every browser engine
drops session cookies when the browsing session ends. Chromium's persistent cookie
store persists *persistent* cookies. `persistWebViewData` doesn't change that on either
side.

### Method caveat — stated plainly

The cookie under test was placed by `document.cookie` (the hybrid restore), not by a
server `Set-Cookie`, because **IS only ever issues `UISAuth` at login** — verified: no
`Set-Cookie` header appears on any authenticated request. Both are session cookies in
the same jar with the same attributes, and Chromium does not record provenance, so the
persistence semantics are the same. Worth knowing the test was run this way regardless.

### Consequence for #158

- **No platform escape hatch. Session restore is required on iOS *and* Android.** The
  earlier note that this "is now the only remaining platform question that could reduce
  scope" is resolved — it does not reduce scope.
- The upside: **one mechanism serves both platforms.** The hybrid restore was verified
  working on Android in this same session (`AUTHED: yes | cookieVisible: true`), using
  identical code to iOS. No per-platform branch is needed for auth.

---

## Test 3 — blob + `a[download]`: **FAILS SILENTLY on Android**

The most dangerous result in the spike, because nothing reports an error.

Ran against a real IS course PDF (`slozka.pl?download=…`, 1.6 MB, `Content-Type:
application/pdf`, `Content-Disposition: attachment`) inside the restored, authenticated
WebView. The probe reproduces `src/injector/documentDownloader.ts`'s exact mechanism.

```
DOWNLOAD PROBE: blob 1620758B — anchor clicked, check Files/Downloads
```

**Everything up to the save works:**

- `fetch(url, {credentials:'include'})` → 200, and the blob is **1,620,758 bytes —
  byte-identical to what `curl` returns**. So the restored cookie authenticates
  subresource fetches, not just navigations. That is a genuinely useful positive.
- `URL.createObjectURL` + `a.download` + `a.click()` all execute without throwing.

**And then nothing is saved.** Checked exhaustively:

| Check | Result |
|---|---|
| `/sdcard/Download/` | empty |
| `find /sdcard -newermt '-10 minutes'` | nothing |
| App-private storage | nothing |
| MediaStore downloads | `No result found` |
| logcat for `DownloadListener` / `onDownloadStart` | never fires |

Android's WebView routes downloads through a `DownloadListener`, and **it is not
invoked for `blob:` URLs** — the click is a no-op. No exception, no console error, no
user-visible failure. A student would tap Download, see nothing happen, and have no
idea why.

### Consequence for #158

- **`@capacitor/filesystem` + `@capacitor/share` are REQUIRED, not optional.** This was
  already the conclusion from reading iOS's lack of `a[download]` support; Android now
  confirms it independently, for a different underlying reason.
- The fetch half is reusable: `fetch` + blob works. Only the **save** step must be
  replaced — write the bytes via Filesystem, then hand off to Share/open. So
  `documentDownloader.ts` needs a platform branch at exactly one point, not a rewrite.
- **Add a regression guard.** A silent no-op is exactly the failure that ships. Whatever
  replaces `a.click()` must assert the file exists after writing.

---

## How these tests were run without a second login

Worth recording, because it is reusable and it avoided the one action that broke a
previous session.

- The `UISAuth` used for restore was one the developer had already supplied, **checked
  live with `curl` first** before spending a build cycle on it.
- The real IS PDF URL came from the **IS Mendelu MCP tools**
  (`list_subject_files` → `downloadUrl`), *not* from tapping around inside the
  authenticated WebView. Tapping inside a live IS session is how an earlier run hit the
  logout link and ended its own session.
- Token and PDF URL were read at runtime from a **gitignored** `src/public/session.local.json`
  rather than typed into a `window.prompt` — `adb`/`simctl` cannot reliably type a
  URL-encoded token, and the alternative (hardcoding) would have put a live credential
  in source. Same pattern as the eduroam cert material.
- Note for vite: the spike's `root` is `./src`, so `publicDir` is **`src/public`**, not
  `./public`.

> ⚠️ **A live session credential ends up on disk and inside the debug APK's assets**
> when tests are run this way. It is gitignored and was never committed (verified
> against the staged diff), but deleting the file does not invalidate the session —
> only logging out of IS does.

### Stale-fact correction

`tisk_dokumentu.pl?potvrzeni_tisk=1` no longer returns a PDF on a bare GET; it returns
HTML saying *"The entered study does not exist."* and needs `studium=…;obdobi=…`. A
28-day-old note recorded it as a one-GET PDF download. Course-file URLs from
`dok_server/slozka.pl?download=…` are the reliable choice for download testing.

---

## Late finding — IS's headers constrain the architecture more than expected

Checked while planning the implementation. These three headers decide *where reIS is
allowed to run*, and none of them were recorded in #158.

```
Access-Control-Allow-Origin: https://localhost.that.never.exists/
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
(no Content-Security-Policy at all)
```

Verified on `/auth/`, `/auth/student/moje_studium.pl`, `/auth/dok_server/index.pl` and
`/system/login.pl` — consistent everywhere, and the ACAO value **does not vary with the
request's `Origin`**. It is a hardcoded sentinel that matches no real origin.

### What each one rules in or out

**`Access-Control-Allow-Origin: https://localhost.that.never.exists/` — CORS is denied
to everybody, deliberately.** Any browser-context fetch to IS from a *different* origin
fails the CORS check, cookies or not. This kills the most obvious mobile design:
"render the #162 phone UI in the Capacitor host WebView and let it fetch IS directly".
It cannot work. `fetchWithAuth` even passes `mode: "cors"` explicitly
(`src/api/client.ts`), which is fine today only because the content script is
*first-party* on `is.mendelu.cz`.

**`X-Frame-Options: SAMEORIGIN` — the reIS app cannot embed IS in an iframe.** Only
`is.mendelu.cz` may frame `is.mendelu.cz`. Note the extension's model is the *reverse*
and is unaffected: the content script runs **on** the IS page and injects an iframe of
the extension app. A top-level `openWebView` is not a frame, so this does not affect the
spike's approach either.

**No `Content-Security-Policy` at all.** IS restricts neither the scripts that run on
its pages nor what it may embed. This is why `preShowScript` injection works
unconstrained (test 0), and it means an injected script may create an iframe pointing at
our own bundled origin — i.e. the extension's exact architecture transplants.

### Consequence: only two viable transports

| Model | Viable? | Why |
|---|---|---|
| reIS in host WebView, fetches IS directly | ❌ | Blocked by CORS |
| reIS in host WebView, host frames IS | ❌ | Blocked by `X-Frame-Options` |
| **A — reIS injected into the IS page** (first-party; iframe + postMessage proxy, exactly as the extension does) | ✅ | No CORS boundary; no CSP to fight |
| **C — reIS in host WebView, data over `CapacitorHttp`** (native HTTP, no browser CORS) | ✅ *in principle* | Native layer is not subject to CORS; **needs verifying that the session cookie flows via `CapacitorCookies`** |

Model **A** reuses the most existing code — `fetchWithAuth` already branches to
`fetchViaProxy` over postMessage when it detects an iframe, so the transport seam exists
and is exercised daily. Model **C** is architecturally cleaner (the phone UI from #162
runs as a normal app rather than injected over a foreign page) but rests on an unverified
assumption about native cookie handling.

**This is the first thing the implementation plan resolves**, because it changes almost
everything downstream. It is cheap to settle: one `CapacitorHttp` request to IS from the
host WebView, with a restored cookie, either returns authenticated HTML or it does not.

---

## Task 7 finding — the shell boots, but nothing drives the sync

Caught by comparing the running app against the extension side by side: the extension
lists the student's subjects; the Capacitor app showed *"Zatím žádné předměty"*. That is
**not** empty data — it is a missing pipeline, and it is a gap in the shell plan rather
than a bug in what the plan specified.

### Evidence

Every IS endpoint the app requested on a full boot:

```
4x  /auth/student/pruchod_studiem.pl              (study progress)
4x  /auth/ca/konfigurace_prenosu_udalosti.pl      (outlook transfer config)
2x  /auth/ca/prehled_tydnu.pl                     (teaching weeks)
```

Those are the paths that fetch **directly from app code**. Nothing fetched subjects,
exams, files, classmates or the study plan.

### Cause

`syncAllData()` lives in `src/injector/syncService.ts` — the **content script** — and
every caller is a content-script file (`bgPokeListener.ts`, `messageHandler.ts`, and its
own interval). It delivers results with `sendToIframe(Messages.syncUpdate(...))`, a
postMessage into the extension's iframe.

Model C has **neither**: no content script to call it, and no iframe to receive it. So
the app authenticates correctly, the transport works, and then almost nothing asks it for
anything.

This is worth stating plainly because it was invisible until the app ran against real
data — the shell looked complete. Boot, auth, transport, back button and downloads are
all genuinely done; the *data* layer is not.

### The promising shape of the fix

`syncAllData` itself is host-agnostic — it calls the `src/api/*` fetchers, which now route
through `fetchWithAuth` and therefore already work on Capacitor (proven: the three
endpoints above returned real authenticated HTML). Only its two ends are extension-shaped:

1. **Nothing calls it.** The app must drive it on boot and on foreground.
2. **`sendToIframe` posts to an iframe.** In Capacitor the app *is* the receiver, so the
   same `Messages.syncUpdate(...)` payload needs dispatching to the app's own listener
   instead — a loopback rather than a cross-frame hop.

If `sendToIframe` gains a Capacitor branch that dispatches locally, **`syncAllData` should
work unchanged**, which would reuse the entire sync implementation rather than forking it.
That is the first thing to try, and it should be tried before writing any new sync code.

> ⚠️ Do not "fix" this by having each screen fetch what it needs. The sync service exists
> because the fan-out is dozens of endpoints, dual-language, with ordering and caching
> rules. Reimplementing that per screen is how the mobile build silently diverges from the
> extension.

### Sync now runs — and exposed the next, smaller gap

The loopback works. `sendToIframe` gained a Capacitor branch that posts to its own
window, and because `window.parent === window` at top level, `useAppLogic`'s existing
`REIS_SYNC_UPDATE` handler consumes it **unchanged**. One sync implementation, three
hosts.

Measured before/after on a full boot:

| | Endpoints fetched |
|---|---|
| Before | 3 |
| After | **14 distinct, ~236 requests** — subjects, syllabi, classmates, documents, exams, schedules, study plan |

The Subjects tab now matches the extension exactly: same study, same 59/180 credits, same
per-subject grades.

**Residual gap — a handful of fetchers bypass `fetchWithAuth`.** Three consistently fail
on Capacitor:

```
Api.fetchCvicneTests      Api.fetchOdevzdavarnyLang      Api.fetchSubjectZaznamnik
```

Cause: they call **bare `fetch(url)`** instead of `fetchWithAuth`, so they never reach the
Capacitor transport and are CORS-blocked. `src/api/cvicneTests.ts:23` is the clearest
example. Enumerated IS-targeting bare fetches:

| File | Line |
|---|---|
| `src/api/cvicneTests.ts` | 23 |
| `src/api/odevzdavarny.ts` | 56 |
| `src/api/kontrola.ts` | 17 |
| `src/api/eduroam.ts` | 31, 37, 55 |

Other bare fetches in `src/api/` target the jsDelivr CDN, Google, Supabase proxies or
`skm.mendelu.cz` — those are unaffected, since they are not IS and serve proper CORS.

> Fixing these means routing them through `fetchWithAuth`, which also imposes its
> `DEFAULT_HEADERS` and its 401/403 login redirect. That is a behaviour change for the
> **extension** too, so each call site needs checking rather than a blind sed. It is a
> small, well-bounded task — but it is not a no-op refactor.

Rejected alternative: enabling Capacitor's global `CapacitorHttp` fetch patch would fix
all of them at once without touching call sites, but it would route *every* request
natively and rely on the native cookie jar — which **does not work on iOS** (measured).
The explicit transport branch exists precisely because of that asymmetry.

---

## File links opened the system browser — fixed, and what it exposed

**Reported symptom:** tapping a file in the app opened Chrome instead of downloading.

**Cause:** `useFileActions` fetches with the browser `fetch`, which IS blocks by CORS on
Capacitor, and its failure path is `window.open(fullUrl, '_blank')` — which Capacitor
hands to the **system browser**. Chrome then has no IS session, so it could not have
loaded the file either. All three actions (`openFile`, `openPdfInline`, `downloadSingle`)
had the same shape.

**Fix:** a native binary transport (`CapacitorHttp` with `responseType: 'blob'`, base64
decoded — a 1.6 MB PDF does **not** survive being handled as a string), using the same
per-platform cookie delivery as the HTML transport.

### The non-obvious part: not every "file" link is a file

`src/api/documents` yields links to **`dokumenty_cteni.pl`** — IS's document *viewer
page*, which legitimately returns `text/html`. The first version of the guard rejected
that as a lapsed session, so downloads failed with *"Expected a document, got text/html"*.

Both cases are HTML, so content-type alone cannot separate them. They are distinguished
by the **same `logout.pl` signal the HTML transport uses**:

| Response | Meaning | Action |
|---|---|---|
| non-HTML | a real file | save via Filesystem, then Share |
| HTML **with** `logout.pl` | an authenticated IS page | open in the **in-app** browser with the session restored |
| HTML **without** `logout.pl` | login page — session lapsed | throw `sessionExpired` |

`fetchIsBinary` returns a discriminated union so callers cannot forget the page case —
the compiler caught all three call sites when it was introduced.

**Device-verified:** the viewer page now opens in-app, authenticated (`Přihlášen: …`),
with no escape to Chrome. Both the row tap and the download icon.

> ⚠️ **Not device-verified: the binary save+share branch.** Every link reachable from the
> subject drawer is a `dokumenty_cteni.pl` viewer page, so the `slozka.pl?download=…`
> branch was exercised only by unit tests (13). It needs a real direct-download link to
> confirm end to end.

### Related gap found while fixing this: `executeAction` has no handler on Capacitor

`executeAction` (`src/api/proxyClient.ts`) posts a `REIS_ACTION` message and waits for a
`REIS_ACTION_RESULT`. The only handler is `src/injector/messageHandler.ts` — **the content
script**. On Capacitor nothing answers, so every one of these silently hangs until
`REQUEST_TIMEOUT`:

```
register_exam · unregister_exam · toggle_outlook_sync · download_file
download_document · trigger_sync · trigger_drive_backup · push_notes
refresh_exams · open_url · logout
```

**`register_exam` matters most** — exam registration is a core feature and one of the few
IS *write* paths. It will appear to do nothing on mobile.

The fix mirrors the sync loopback: give the app an action handler that receives
`REIS_ACTION` from its own window and replies with `REIS_ACTION_RESULT`, reusing
`messageHandler`'s logic rather than reimplementing it. That is the next task.
