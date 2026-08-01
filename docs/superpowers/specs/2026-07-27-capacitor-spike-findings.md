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
| Xcode / iOS Simulator | Xcode 26.6 (build 17F113), iOS 26.5 Simulator runtime pending |
| Android emulator API level | not installed |

## Results

| # | Question | Answer | Evidence |
|---|---|---|---|
| 0 | Does `preShowScript` injection run on IS? | **YES — at documentStart** | Green banner `REIS INJECTION OK — readyState at inject: loading` on the IS login page |
| 1 | Does iOS WKWebView keep `UISAuth` across app kill? | pending — needs login | `getCookies` verified working (`keys: (none) / UISAuth: ABSENT` with no session) |
| 2 | Does Android WebView keep `UISAuth` across app kill? | pending | |
| 3 | Does blob + `a[download]` save a file? | pending — needs login | probe built, needs a real IS PDF URL |
| 4 | Does `ACTION_WIFI_ADD_NETWORKS` accept an EAP-TLS config? | pending | |

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
- `npx cap add android` requires a JDK. Absent here, so the spike is iOS-only.
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
| 1 — iOS cookie survival across app kill | human: real credentials + app-switcher kill |
| 2 — Android cookie survival | Android Studio + JDK not installed |
| 3 — file download | human: login + a real IS PDF URL + Files app check |
| 4 — `ACTION_WIFI_ADD_NETWORKS` EAP-TLS (#159) | Android Studio + JDK not installed |

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
