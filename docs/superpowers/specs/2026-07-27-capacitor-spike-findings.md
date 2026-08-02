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

pending

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
  `Invalid runtime`. Prefer Xcode's Components UI over `simctl runtime delete`.

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
