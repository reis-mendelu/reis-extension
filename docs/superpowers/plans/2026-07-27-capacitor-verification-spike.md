# Capacitor Verification Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Answer five device-only questions with one deliberately throwaway Capacitor app, so that the real Capacitor work (#158) is planned against measured facts instead of assumptions.

**Architecture:** A minimal Capacitor app — no reIS code, no build integration, living outside the extension repo — that opens the real IS Mendelu in `openWebView()` and lets a human log in. Each question is answered by a small injected script or a small native call, and the results are written into a findings document that updates #158 and #159.

**Tech Stack:** Capacitor (latest stable), `@capgo/capacitor-inappbrowser`, Xcode + iOS Simulator, Android Studio emulator or a physical Android device, Kotlin (one small plugin for the eduroam test).

## Global Constraints

- **The spike app is throwaway.** It lives at `../reis-capacitor-spike` (sibling of `reis-extension`), is never merged into the extension repo, and nothing from it ships.
- **Never commit secrets.** No session cookie value, no `.p12`, no extraction password, no screenshot containing a logged-in student's personal data may be committed to any repo. Redact tokens to first-6/last-4 when recording findings.
- **This spike is read-only against IS**, with one exception: the eduroam test (Task 6) writes a WiFi config to the *device*, not to IS. Do not exercise exam registration or `outlookSync` from the spike.
- **Known facts from the audit — do not re-derive** (`docs/superpowers/specs/2026-07-26-capacitor-assumption-audit.md`):
  - Auth state is exactly one cookie: `UISAuth`, `domain=is.mendelu.cz`, `path=/`, no `Expires`, `HttpOnly`, `Secure`, `SameSite=Lax`
  - The IS session survives process death, User-Agent change, and total cookie-attribute loss
  - IS session lifetime is ~7 days absolute; there is no sliding idle timeout
  - Login is a plain form POST to `/system/login.pl` (`credential_0` / `credential_1`) — no SSO
- **eduroam config values — do not re-derive** (`#159`, from MENDELU's own Android guide): SSID `eduroam`, EAP `TLS`, CA = MENDELU root, domain suffix `mendelu.cz`, identity `<login>@mendelu.cz`, OCSP off.
- Record the **exact Capacitor version** installed rather than assuming one; pin it in the findings doc.

---

## File Structure

Everything lives in a scratch sibling repo, not in `reis-extension`:

| Path | Responsibility |
|---|---|
| `../reis-capacitor-spike/` | The throwaway app. Never merged. |
| `../reis-capacitor-spike/src/main.ts` | Buttons that trigger each test; prints results on screen |
| `../reis-capacitor-spike/src/probes/injection.ts` | The `preShowScript` payload for Task 3 |
| `../reis-capacitor-spike/src/probes/download.ts` | The blob-download probe for Task 5 |
| `../reis-capacitor-spike/android/.../EduroamProbePlugin.kt` | Minimal native plugin for Task 6 |
| `reis-extension/docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md` | **The actual deliverable.** Results, committed to the extension repo. |

The only artifact that outlives the spike is the findings document.

---

### Task 1: Scaffold the throwaway app and pin versions

**Files:**
- Create: `../reis-capacitor-spike/` (whole project)
- Create: `reis-extension/docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md`

**Interfaces:**
- Consumes: nothing
- Produces: a runnable Capacitor app on iOS and Android; a findings doc with a `## Environment` section recording exact versions

- [ ] **Step 1: Create the project outside the extension repo**

```bash
cd /Users/dominik-personal/Documents
npm create @capacitor/app@latest reis-capacitor-spike -- --name "reIS Spike" --app-id cz.reis.spike
cd reis-capacitor-spike
npm install
```

- [ ] **Step 2: Add the InAppBrowser plugin and both platforms**

```bash
npm install @capgo/capacitor-inappbrowser
npm install @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

- [ ] **Step 3: Record exact versions — do not assume**

```bash
npx cap --version
npm ls @capacitor/core @capacitor/ios @capacitor/android @capgo/capacitor-inappbrowser --depth=0
```

Expected: a version table. Copy it verbatim into the findings doc's `## Environment` section. The `@capgo/capacitor-inappbrowser` version matters — proxy handling changed breakingly in 8.6.0.

- [ ] **Step 4: Verify both platforms launch with a blank app**

```bash
npx cap run ios
```

Expected: iOS Simulator boots and shows the default app. Then:

```bash
npx cap run android
```

Expected: emulator/device shows the default app. **If either fails, stop and fix the toolchain before continuing** — every later task depends on both running.

- [ ] **Step 5: Create the findings doc skeleton and commit it**

Create `reis-extension/docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md`:

```markdown
# Capacitor spike — findings

Results of the day-one device tests from #158. Each answer is measured, not inferred.

## Environment

| Component | Version |
|---|---|
| Capacitor CLI | TBD-fill-from-step-3 |
| @capacitor/core | |
| @capacitor/ios | |
| @capacitor/android | |
| @capgo/capacitor-inappbrowser | |
| Xcode / iOS Simulator | |
| Android emulator API level | |

## Results

| # | Question | Answer | Evidence |
|---|---|---|---|
| 0 | Does `preShowScript` injection run on IS? | pending | |
| 1 | Does iOS WKWebView keep `UISAuth` across app kill? | pending | |
| 2 | Does Android WebView keep `UISAuth` across app kill? | pending | |
| 3 | Does blob + `a[download]` save a file? | pending | |
| 4 | Does `ACTION_WIFI_ADD_NETWORKS` accept an EAP-TLS config? | pending | |

## Consequences for #158

pending
```

Fill the Environment table from Step 3 now. Then:

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md
git commit -m "docs: capacitor spike findings skeleton + pinned environment"
```

---

### Task 2: Open real IS in `openWebView` and log in

**Files:**
- Modify: `../reis-capacitor-spike/src/main.ts`

**Interfaces:**
- Consumes: the scaffolded app from Task 1
- Produces: `openIs(): Promise<void>` — opens `https://is.mendelu.cz/auth/` in `openWebView`. Every later task starts from this state.

- [ ] **Step 1: Replace `src/main.ts` with an IS launcher**

```ts
import { InAppBrowser } from '@capgo/capacitor-inappbrowser';

const IS_URL = 'https://is.mendelu.cz/auth/';

export async function openIs(): Promise<void> {
  await InAppBrowser.openWebView({ url: IS_URL, title: 'IS Mendelu' });
}

document.querySelector('#app')!.innerHTML = `
  <button id="open">Open IS</button>
  <pre id="out"></pre>
`;
document.querySelector('#open')!.addEventListener('click', () => void openIs());
```

- [ ] **Step 2: Build, sync, and run on iOS**

```bash
npm run build && npx cap sync && npx cap run ios
```

- [ ] **Step 3: Log in manually and confirm you reach the dashboard**

Tap "Open IS", enter real MENDELU credentials in the WebView, and confirm the IS dashboard renders.

Expected: the IS dashboard loads inside `openWebView`. **If IS refuses to render in the WebView at all** (framing rules, UA blocking, a WAF challenge), that is a finding that invalidates the whole approach — record it and stop.

- [ ] **Step 4: Commit the spike app**

```bash
cd /Users/dominik-personal/Documents/reis-capacitor-spike
git init -q 2>/dev/null; git add -A
git commit -m "spike: open real IS in openWebView"
```

---

### Task 3: Test 0 — does `preShowScript` injection actually run?

This gates everything else, including the cookie question. If reIS cannot be injected into the IS page, the architecture in #158 does not exist.

**Files:**
- Create: `../reis-capacitor-spike/src/probes/injection.ts`
- Modify: `../reis-capacitor-spike/src/main.ts`

**Interfaces:**
- Consumes: `openIs()` from Task 2
- Produces: `INJECTION_PROBE: string` — a JS source string suitable for `preShowScript`

- [ ] **Step 1: Write the injection probe**

Create `src/probes/injection.ts`:

```ts
/** Runs at documentStart inside the IS page. Proves injection works and that
 *  it beats page JS, by stamping a marker before IS scripts run. */
export const INJECTION_PROBE = `
  (function () {
    window.__REIS_SPIKE__ = { at: Date.now(), readyState: document.readyState };
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.id = 'reis-spike-banner';
      b.textContent = 'REIS INJECTION OK — readyState at inject: ' + window.__REIS_SPIKE__.readyState;
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0a0;color:#fff;font:14px system-ui;padding:8px;text-align:center';
      document.body.appendChild(b);
    });
  })();
`;
```

- [ ] **Step 2: Wire it into `openIs()`**

In `src/main.ts`, replace the `openWebView` call:

```ts
import { INJECTION_PROBE } from './probes/injection';

export async function openIs(): Promise<void> {
  await InAppBrowser.openWebView({
    url: IS_URL,
    title: 'IS Mendelu',
    preShowScript: INJECTION_PROBE,
    preShowScriptInjectionTime: 'documentStart',
  });
}
```

- [ ] **Step 3: Run on iOS and observe**

```bash
npm run build && npx cap sync && npx cap run ios
```

Tap "Open IS". Expected: a **green banner** across the top of the IS login page reading `REIS INJECTION OK — readyState at inject: loading`.

- `readyState: loading` → injection genuinely runs at document start. Best case.
- Banner appears but `readyState` is `interactive`/`complete` → injection works but runs late. Record it; it affects whether reIS can hide the page before IS paints.
- **No banner** → injection is blocked. Check the WebView console for a CSP violation. This would be fatal to #158's architecture — record and stop.

- [ ] **Step 4: Repeat on Android**

```bash
npx cap run android
```

Expected: same banner. Record any difference between platforms.

- [ ] **Step 5: Test re-injection across navigation**

IS is a multi-page app. In the WebView, click through to any other IS page (e.g. *Moje studium*).

Expected: the banner is **gone** — `preShowScript` applies to the initial load only. This confirms the `urlChangeEvent` → `executeScript()` re-injection in #158 is genuinely required, rather than a precaution.

- [ ] **Step 6: Record the result and commit**

Fill row 0 of the findings table with the answer, both platforms, and the observed `readyState`. Then:

```bash
cd /Users/dominik-personal/Documents/reis-capacitor-spike && git add -A && git commit -m "spike: injection probe"
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md
git commit -m "docs(spike): record injection probe result"
```

---

### Task 4: Tests 1 & 2 — cookie survival across app kill

**Files:**
- Modify: `../reis-capacitor-spike/src/main.ts`

**Interfaces:**
- Consumes: `openIs()` from Task 2
- Produces: `readCookies(): Promise<Record<string, string>>`

- [ ] **Step 1: Add a cookie reader**

In `src/main.ts`:

```ts
export async function readCookies(): Promise<Record<string, string>> {
  return InAppBrowser.getCookies({ url: 'https://is.mendelu.cz/', includeHttpOnly: true });
}

function redact(v: string): string {
  return v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)} (len ${v.length})` : '(short)';
}

document.querySelector('#app')!.insertAdjacentHTML('beforeend', `<button id="ck">Read cookies</button>`);
document.querySelector('#ck')!.addEventListener('click', async () => {
  const c = await readCookies();
  const uis = c['UISAuth'];
  document.querySelector('#out')!.textContent =
    `keys: ${Object.keys(c).join(', ') || '(none)'}\nUISAuth: ${uis ? redact(uis) : 'ABSENT'}`;
});
```

Note the redaction — the raw value must never be screenshotted or committed.

- [ ] **Step 2: Establish a logged-in baseline on iOS**

```bash
npm run build && npx cap sync && npx cap run ios
```

Open IS, log in, close the WebView, tap "Read cookies".

Expected: `UISAuth: <redacted> (len 46)`. **If `UISAuth` is absent here**, `getCookies` cannot see HttpOnly cookies in this plugin version — that is itself the finding, and cookie restore is impossible via this API. Record and skip to Step 4.

- [ ] **Step 3: Kill and relaunch — the actual test**

Fully terminate the app (swipe up from the app switcher — **not** just backgrounding it; `WKProcessPool` only resets on a real kill). Relaunch from the home screen. Tap "Read cookies" **without logging in again**.

- `UISAuth` present → **session restore machinery is unnecessary.** Confirm by opening IS and checking you land on the dashboard rather than the login form.
- `UISAuth` absent → restore is mandatory; Plan 4 (Keychain restore) becomes real work.

- [ ] **Step 4: Repeat the whole sequence on Android**

```bash
npx cap run android
```

Expected: present. Android WebView is Chromium and `CookieManager.removeSessionCookies()` exists precisely because session cookies persist — but measure rather than assume.

- [ ] **Step 5: Record both results and commit**

Fill rows 1 and 2. State explicitly, in `## Consequences for #158`, whether the session-restore workstream survives.

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md
git commit -m "docs(spike): record cookie survival on iOS and Android"
```

---

### Task 5: Test 3 — does the existing download mechanism work?

reIS downloads files via `URL.createObjectURL()` + an anchor with `download` ([`src/injector/documentDownloader.ts:31-38`](../../../src/injector/documentDownloader.ts)). This probe isolates that exact mechanism rather than porting reIS.

**Files:**
- Create: `../reis-capacitor-spike/src/probes/download.ts`
- Modify: `../reis-capacitor-spike/src/main.ts`

**Interfaces:**
- Consumes: a logged-in IS session in the WebView (Task 2)
- Produces: `DOWNLOAD_PROBE: string` — a JS source string for `executeScript`

- [ ] **Step 1: Write the download probe**

Create `src/probes/download.ts`:

```ts
/** Reproduces documentDownloader.ts's exact save mechanism against a real IS
 *  PDF, and reports what happened via the on-page banner. */
export const DOWNLOAD_PROBE = `
  (async function () {
    function say(msg) {
      var b = document.getElementById('reis-spike-banner') || document.createElement('div');
      b.id = 'reis-spike-banner';
      b.textContent = 'DOWNLOAD PROBE: ' + msg;
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#a00;color:#fff;font:14px system-ui;padding:8px;text-align:center';
      document.body.appendChild(b);
    }
    try {
      var url = window.__SPIKE_PDF_URL__;
      if (!url) return say('no PDF url set');
      var res = await fetch(url, { credentials: 'include' });
      say('fetch ' + res.status + ' ' + (res.headers.get('content-type') || ''));
      if (!res.ok) return;
      var blob = await res.blob();
      var objectUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'spike-test.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      say('blob ' + blob.size + 'B — anchor clicked, check Files/Downloads');
    } catch (e) { say('THREW: ' + e); }
  })();
`;
```

- [ ] **Step 2: Add a trigger that sets a real PDF URL then runs the probe**

In `src/main.ts`:

```ts
import { DOWNLOAD_PROBE } from './probes/download';

document.querySelector('#app')!.insertAdjacentHTML('beforeend', `<button id="dl">Run download probe</button>`);
document.querySelector('#dl')!.addEventListener('click', async () => {
  await InAppBrowser.executeScript({ code: DOWNLOAD_PROBE });
});
```

- [ ] **Step 3: Get a real IS PDF URL and feed it to the probe**

In the WebView, navigate to any subject's document folder and long-press a PDF to copy its link. Paste it into a prompt when the button is tapped — the URL is student-specific, so it must not be hardcoded into the committed spike:

```ts
document.querySelector('#dl')!.addEventListener('click', async () => {
  const pdfUrl = window.prompt('Paste a real IS PDF URL (from the WebView)');
  if (!pdfUrl) return;
  await InAppBrowser.executeScript({
    code: `window.__SPIKE_PDF_URL__ = ${JSON.stringify(pdfUrl)};`,
  });
  await InAppBrowser.executeScript({ code: DOWNLOAD_PROBE });
});
```

This replaces the simpler listener from Step 2 — the probe must run *after* the URL is set, in that order.

- [ ] **Step 4: Run on iOS and check whether a file actually landed**

Tap "Run download probe", then open the **Files** app and look in *On My iPhone* and *Downloads*.

Expected (prediction to be tested): the banner reports `blob <size>B — anchor clicked`, but **no file exists**. WKWebView does not support `a[download]`.

- The banner says the blob was created **and** a file exists → downloads work; `@capacitor/filesystem` is not required.
- Blob created but **no file** → confirmed broken. `@capacitor/filesystem` + `@capacitor/share` become mandatory for the SubjectFileDrawer.
- `fetch` returns HTML instead of `application/pdf` → the session did not ride the request; that is a *different and more serious* finding about credentialed fetches in the WebView.

- [ ] **Step 5: Repeat on Android**

Check the **Downloads** folder. Expected: also no file — Android's `DownloadListener` does not fire for `blob:` URLs.

- [ ] **Step 6: Record and commit**

Fill row 3, and note explicitly in `## Consequences for #158` whether the "required plugins" list holds.

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md
git commit -m "docs(spike): record file download behaviour on both platforms"
```

---

### Task 6: Test 4 — does `ACTION_WIFI_ADD_NETWORKS` accept an EAP-TLS config?

Android only. Independent of the WebView, so it can run in parallel with Tasks 3–5. Answers the one open item in #159.

**Files:**
- Create: `../reis-capacitor-spike/android/app/src/main/java/cz/reis/spike/EduroamProbePlugin.kt`
- Modify: `../reis-capacitor-spike/android/app/src/main/java/cz/reis/spike/MainActivity.java`

**Interfaces:**
- Consumes: a `.p12` + root CA downloaded manually from IS
- Produces: an `EduroamProbe.configure({ p12Base64, passphrase, caDerBase64, login })` plugin method

- [ ] **Step 1: Download real cert material from IS by hand**

In a desktop browser, visit `https://is.mendelu.cz/auth/wifi/certifikat.pl?lang=cz`, note the extraction password, and download:
- `?get=user-p12` → `user.p12`
- `?get=root-der` → `root.der`

**Do not commit these.** Add `*.p12` and `*.der` to the spike's `.gitignore` before proceeding.

- [ ] **Step 2: Write the probe plugin**

Create `EduroamProbePlugin.kt`:

```kotlin
package cz.reis.spike

import android.content.Intent
import android.net.wifi.WifiEnterpriseConfig
import android.net.wifi.WifiNetworkSuggestion
import android.os.Bundle
import android.provider.Settings
import android.util.Base64
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.ByteArrayInputStream
import java.security.KeyStore
import java.security.PrivateKey
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate

@CapacitorPlugin(name = "EduroamProbe")
class EduroamProbePlugin : Plugin() {

    @PluginMethod
    fun configure(call: PluginCall) {
        val p12 = Base64.decode(call.getString("p12Base64")!!, Base64.DEFAULT)
        val pass = call.getString("passphrase")!!.toCharArray()
        val caDer = Base64.decode(call.getString("caDerBase64")!!, Base64.DEFAULT)
        val login = call.getString("login")!!

        val ks = KeyStore.getInstance("PKCS12").apply { load(ByteArrayInputStream(p12), pass) }
        val alias = ks.aliases().nextElement()
        val key = ks.getKey(alias, pass) as PrivateKey
        val clientCert = ks.getCertificate(alias) as X509Certificate
        val ca = CertificateFactory.getInstance("X.509")
            .generateCertificate(ByteArrayInputStream(caDer)) as X509Certificate

        val enterprise = WifiEnterpriseConfig().apply {
            eapMethod = WifiEnterpriseConfig.Eap.TLS
            setCaCertificate(ca)
            setClientKeyEntry(key, clientCert)
            domainSuffixMatch = "mendelu.cz"
            identity = "$login@mendelu.cz"
        }

        val suggestion = WifiNetworkSuggestion.Builder()
            .setSsid("eduroam")
            .setWifiEnterpriseConfig(enterprise)
            .build()

        val intent = Intent(Settings.ACTION_WIFI_ADD_NETWORKS).putExtras(
            Bundle().apply {
                putParcelableArrayList(
                    Settings.EXTRA_WIFI_NETWORK_LIST, arrayListOf(suggestion)
                )
            }
        )
        startActivityForResult(call, intent, "onAddResult")
    }

    @com.getcapacitor.annotation.ActivityCallback
    private fun onAddResult(call: PluginCall, result: androidx.activity.result.ActivityResult) {
        val codes = result.data
            ?.getIntegerArrayListExtra(Settings.EXTRA_WIFI_NETWORK_RESULT_LIST)
            ?.joinToString(",") ?: "(none)"
        call.resolve(com.getcapacitor.JSObject()
            .put("resultCode", result.resultCode)
            .put("perNetwork", codes))
    }
}
```

- [ ] **Step 3: Register the plugin**

In `MainActivity.java`:

```java
package cz.reis.spike;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EduroamProbePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

- [ ] **Step 4: Add the permission**

In `android/app/src/main/AndroidManifest.xml`, inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
```

- [ ] **Step 5: Call it from the app**

In `src/main.ts`, add a button that base64-encodes the two files (paste them in as constants for the spike — they are gitignored) and calls:

```ts
import { registerPlugin } from '@capacitor/core';
const EduroamProbe = registerPlugin<{
  configure(o: { p12Base64: string; passphrase: string; caDerBase64: string; login: string }):
    Promise<{ resultCode: number; perNetwork: string }>;
}>('EduroamProbe');
```

- [ ] **Step 6: Run it and record what happens**

```bash
npx cap run android
```

Tap the eduroam button.

- A **system dialog** appears offering to save `eduroam`, and tapping Save returns `resultCode: -1` (`RESULT_OK`) with per-network `0` (`ADD_WIFI_RESULT_SUCCESS`) → **enterprise EAP-TLS works through this path. #159's approach is confirmed.**
- `ADD_WIFI_RESULT_ADD_OR_UPDATE_FAILED` (1) → the config was rejected. Most likely the Android 11 QPR1 enterprise rules; verify the CA and `domainSuffixMatch` are both set.
- The builder throws before the intent → enterprise configs are not accepted by this path; #159 falls back to `addNetworkSuggestions`, with its 24-hour disconnect penalty understood.

- [ ] **Step 7: Confirm it appears as a real saved network**

Open Settings → WiFi → Saved networks.

Expected: `eduroam` is listed and deletable — confirming it is a real saved network, not an invisible suggestion. This is the property that made this API the right choice.

- [ ] **Step 8: Record and commit**

Fill row 4 and update `## Consequences for #158` and a comment on #159.

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md
git commit -m "docs(spike): record ACTION_WIFI_ADD_NETWORKS enterprise result"
```

> **On-campus follow-up, not part of this task:** saving the config proves Android *accepts* it. Proving it *connects* requires being in range of a MENDELU AP. Log that as a separate check.

---

### Task 7: Decide where the mobile project lives, and close out

**Files:**
- Modify: `reis-extension/docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md`

**Interfaces:**
- Consumes: all results from Tasks 3–6
- Produces: a written decision that Plan 2 (the Capacitor shell) depends on

- [ ] **Step 1: Write the repo-location decision**

Append to the findings doc:

```markdown
## Decision: where the Capacitor project lives

**Options considered**
- **A — in `reis-extension`:** `android/` + `ios/` alongside the WXT extension. Shares `src/`
  directly, one version number, one CI. Cost: two build systems in one repo, native
  toolchains in every contributor's clone, and `wxt zip` must never pick up native dirs.
- **B — sibling `reis-mobile` repo:** clean separation, own release cadence. Cost: `src/`
  must be consumed as a package or a git submodule, and the parser anti-drift guarantee
  (`scripts/lib/__tests__/no-parser-reimpl.test.ts`) no longer spans both.

**Decision:** [A or B] — [reason]
```

**Recommended: option A (in `reis-extension`).** The architecture's load-bearing property is that the parsers exist once and are reused everywhere — `scripts/lib/__tests__/no-parser-reimpl.test.ts` enforces exactly this, and `scripts/lib/nodeRuntime.ts` already proves `src/api/*` runs outside a browser. Splitting repos means either publishing `src/` as a package or carrying a submodule, and the anti-drift test stops spanning both sides. The cost of option A — native toolchains in the clone, and keeping `wxt zip` away from `android/`/`ios/` — is a `.gitignore` and a build-config concern, which is cheaper than losing the single-parser guarantee.

Record the decision even if it matches the recommendation, with the reason, so Plan 2 does not reopen it.

- [ ] **Step 2: Write the consequences section**

Replace `## Consequences for #158` with explicit statements for each result — e.g. *"Session restore: NOT NEEDED, cookie survived on both platforms"* or *"Session restore: REQUIRED on iOS."* Every downstream plan reads this section rather than re-deriving.

- [ ] **Step 3: Update the issues**

```bash
gh issue comment 158 --repo reis-mendelu/reis-extension --body "Spike complete — results in \`docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md\`. See the Consequences section for which parts of this issue survive."
```

Then tick the four day-one checkboxes in #158 and, if Task 6 succeeded, the open verification item in #159.

- [ ] **Step 4: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-extension/.claude/worktrees/reis-testing-report-887f67
git add docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md
git commit -m "docs(spike): repo-location decision and consequences for #158"
```

- [ ] **Step 5: Decide the spike app's fate**

The spike app has served its purpose. Either delete `../reis-capacitor-spike` or keep it as a scratch reference — but **it must never be merged into `reis-extension`**. Note which you chose in the findings doc.

---

## What this plan deliberately does not cover

Each of these is a separate plan, blocked on this one's results:

| Plan | Blocked by |
|---|---|
| Capacitor shell (scaffold, injection, `chrome.*` shim) | Task 3 |
| Required plugins (back button, filesystem/share) | Task 5 |
| Session restore (Keychain) | Task 4 — **may be cancelled entirely** |
| Android eduroam (#159) | Task 6 |
| Local notifications | staleness-guard decision |
| OTA channel | the parser-breakage measurement |
