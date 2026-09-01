# eduroam on iOS — native one-tap Wi-Fi setup: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inside the reIS iOS app, one tap on "Set up eduroam" plus iOS's own Join alert puts the device on eduroam, with no profile file, QR, or typed password — verified by the developer's iPad associating on campus.

**Architecture:** A new local Swift Capacitor plugin package (`native/capacitor-eduroam`) registers under the same JS name (`Eduroam`) as the existing Android Java plugin, so `registerPlugin('Eduroam')` resolves to the right native half per OS with no TypeScript branching. Both native halves resolve a platform-neutral `{ outcome, detail? }` result; the Android plugin gains that mapping in Java and the Android constants leave TypeScript. The sheet resolves its target from `Capacitor.getPlatform()` on the Capacitor host instead of the user agent. Two entitlements (Hotspot Configuration and one keychain access group) are committed to the Xcode project.

**Tech Stack:** Capacitor 8 (SPM, `packageClassList` registration), Swift 5.9 / `NetworkExtension` (`NEHotspotConfigurationManager`, `NEHotspotEAPSettings`) / `Security` (`SecPKCS12Import`, `SecItemAdd`), Java (Android plugin) + JUnit 4, TypeScript + React + Vitest + Testing Library, i18n JSON (`cs`, `en`).

**Spec:** `docs/superpowers/specs/2026-09-01-eduroam-ios-native-design.md` — read it first; §5 (Swift stages), §6 (entitlements), §8 (checklist) are load-bearing.

## Global Constraints

- **Iron rules** (`CLAUDE.md`): no `localStorage`; no proxy/re-export files; no `useEffect` for data fetching; DaisyUI classes only, no custom CSS; max 200 lines per file (split proactively); direct imports only; **test first**.
- **Plugin JS name is `Eduroam` on both platforms.** Swift `jsName = "Eduroam"`, Java `@CapacitorPlugin(name = "Eduroam")`. Do not rename either.
- **iOS plugins must be packages under `native/`, never files in the app target** — `native/capacitor-secure-store/README.md` records why. Package name `@reis/capacitor-eduroam` → SPM product `ReisCapacitorEduroam` (cap sync derives it; a mismatch fails at dependency resolution).
- **Neutral result contract:** `{ outcome: 'saved' | 'already-configured' | 'cancelled' | 'failed'; detail?: string }`. Unknown or missing `outcome` is `'failed'` in TypeScript (fail closed).
- **SSID `eduroam`; `trustedServerNames = ["aleph.mendelu.cz"]`; EAP-TLS only (`supportedEAPTypes = [13]`); `isTLSClientCertificateRequired = true`.** No `lifeTimeInDays`, `joinOnce` false.
- **Keychain access group is exactly `<AppIdentifierPrefix>com.apple.networkextensionsharing`.** Never request persistent references (`kSecReturnPersistentRef`) — iOS then reports invalid EAP settings. Labels: `reIS eduroam identity`, `reIS eduroam chain`, `reIS eduroam root`. Clean old items first, so certificate renewal replaces in place.
- **Entitlements file contains only** `com.apple.developer.networking.HotspotConfiguration` = true and `keychain-access-groups` = `[$(AppIdentifierPrefix)com.apple.networkextensionsharing]`.
- **iOS 15.0 and 15.1 reject** with a clear message (platform bug with `setTrustedServerCertificates`, fixed in 15.2). Deployment target stays 15.0.
- **Team ID** `RG38V3SV8X` comes from the command line (`DEVELOPMENT_TEAM=…`); the project stays teamless. The team prefix reaches Swift through an Info.plist key expanded from `$(AppIdentifierPrefix)`, never a hard-coded string.
- **Copy:** `eduroam.native.working` → "Opening Wi-Fi setup…" / "Otevírám nastavení Wi-Fi…"; `eduroam.native.privacyNote` → "The certificate never leaves your device — reIS hands it straight to the system." / "Certifikát nikam neodchází — reIS ho předá rovnou systému."; new `eduroam.native.iosLifetime` → "eduroam stays set up as long as reIS is installed." / "eduroam zůstane nastavený, dokud máte reIS nainstalovaný." Rendered on iOS only.
- **Nothing student-identifying leaves the device.** The `.p12`, root DER, and extraction password cross the Capacitor bridge only. No telemetry may contain them.
- **Commands run from the worktree root** `/Users/Dominik.Holek/Documents/reis/reis-extension/.claude/worktrees/posthog-attendance-issues-8e10e9`. Never `git stash`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `android/app/src/main/java/cz/reis/app/EduroamOutcome.java` (new) | Pure mapping of Android intent result codes → neutral outcome string. No Android imports, so it runs under plain JUnit. | 1 |
| `android/app/src/test/java/cz/reis/app/EduroamOutcomeTest.java` (new) | JUnit table test of the mapping. | 1 |
| `android/app/src/main/java/cz/reis/app/EduroamPlugin.java` | `onAddResult` resolves `{outcome, detail, identity, caSubject}` instead of raw codes. | 1 |
| `src/mobile/configureEduroam.ts` | Neutral `NativeConfigureResult`, `normalizeOutcome`, `configureEduroam`. Android constants removed. | 2 |
| `src/mobile/__tests__/configureEduroam.test.ts` | Tests for the neutral contract and fail-closed rule. | 2 |
| `src/hooks/data/__tests__/useEduroamSetup.test.ts` | Native-path tests re-pointed at `{ outcome }`. | 2 |
| `src/mobile/eduroamNative.ts` | `canConfigureEduroamNatively` admits `'ios'`; new `nativeEduroamTarget()`. | 3 |
| `src/mobile/__tests__/eduroamNative.test.ts` (new) | Host × target matrix; Capacitor platform resolution. | 3 |
| `src/components/mobile/sheets/EduroamSheet.tsx` | `detectTarget()` prefers Capacitor; iOS-only lifetime line. | 4 |
| `src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx` | Target from Capacitor; lifetime line on iOS only. | 4 |
| `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` | Two neutral strings, one new key. | 4 |
| `src/i18n/__tests__/eduroamWindowsKeys.test.ts` | Asserts the `native.*` keys exist in both locales. | 4 |
| `native/capacitor-eduroam/package.json`, `Package.swift`, `ios/Sources/EduroamPlugin/EduroamPlugin.swift`, `README.md` (new) | The iOS plugin package. | 5 |
| `package.json` | `@reis/capacitor-eduroam` file dependency. | 5 |
| `ios/App/App/App.entitlements` (new), `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/App/Info.plist` | Entitlements wiring and the `AppIdentifierPrefix` key. | 5 |
| `native/capacitor-secure-store/README.md` | One sentence: the Eduroam iOS half is now a package. | 5 |
| `docs/superpowers/specs/2026-09-01-eduroam-ios-verification-checklist.md` (new) | Device checklist, filled in on campus. | 6 |
| `docs/app-store-listing.md` | §10 "no capabilities" line corrected. | 6 |

---

### Task 1: Android plugin resolves the neutral outcome

**Files:**
- Create: `android/app/src/main/java/cz/reis/app/EduroamOutcome.java`
- Create: `android/app/src/test/java/cz/reis/app/EduroamOutcomeTest.java`
- Modify: `android/app/src/main/java/cz/reis/app/EduroamPlugin.java` (the `onAddResult` method at the end of the file, and the imports)

**Interfaces:**
- Consumes: nothing new.
- Produces: the resolved JS object `{ outcome: string, detail: string, identity: string, caSubject: string }` where `outcome` ∈ `saved | already-configured | cancelled | failed`. Task 2's TypeScript reads `outcome` and `detail`.

- [ ] **Step 1: Write the failing JUnit test**

`android/app/src/test/java/cz/reis/app/EduroamOutcomeTest.java`:

```java
package cz.reis.app;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.junit.Test;

/**
 * The intent result → outcome mapping the JS side shares with iOS. Pure Java
 * on purpose: no Android classes, so it runs under plain JUnit on the host.
 */
public class EduroamOutcomeTest {

    private static List<Integer> codes(Integer... c) {
        return Arrays.asList(c);
    }

    @Test
    public void success_is_saved() {
        assertEquals("saved", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, codes(0)));
    }

    @Test
    public void already_exists_is_success_not_an_error() {
        // A student re-running setup has the network they wanted.
        assertEquals("already-configured", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, codes(2)));
    }

    @Test
    public void add_or_update_failed_is_failed() {
        assertEquals("failed", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, codes(1)));
    }

    @Test
    public void canceled_dialog_is_cancelled_not_failed() {
        assertEquals("cancelled", EduroamOutcome.outcome(EduroamOutcome.RESULT_CANCELED, null));
    }

    @Test
    public void ok_with_no_codes_fails_closed() {
        // Guessing "saved" sends a student to campus with wi-fi that never connects.
        assertEquals("failed", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, null));
        assertEquals("failed", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, Collections.<Integer>emptyList()));
    }

    @Test
    public void unknown_code_fails_closed() {
        assertEquals("failed", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, codes(99)));
    }

    @Test
    public void only_the_first_code_counts() {
        // One network is requested; extra codes are noise.
        assertEquals("saved", EduroamOutcome.outcome(EduroamOutcome.RESULT_OK, codes(0, 1)));
    }

    @Test
    public void detail_names_both_levels_for_diagnostics() {
        assertEquals("resultCode=-1 perNetwork=[1]", EduroamOutcome.detail(EduroamOutcome.RESULT_OK, codes(1)));
        assertEquals("resultCode=0 perNetwork=(none)", EduroamOutcome.detail(EduroamOutcome.RESULT_CANCELED, null));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails to compile**

Run:
```bash
cd android && ./gradlew testDebugUnitTest --tests 'cz.reis.app.EduroamOutcomeTest' -q 2>&1 | tail -15; cd ..
```
Expected: compilation error mentioning `EduroamOutcome` cannot be found. (First Gradle run in a fresh worktree may take a few minutes to resolve dependencies.)

- [ ] **Step 3: Write the mapper**

`android/app/src/main/java/cz/reis/app/EduroamOutcome.java`:

```java
package cz.reis.app;

import java.util.List;

/**
 * Maps the two-level ACTION_WIFI_ADD_NETWORKS result onto the outcome vocabulary
 * the JS side shares with the iOS plugin: saved | already-configured |
 * cancelled | failed.
 *
 * Pure Java with no Android imports so it runs under plain JUnit. The constants
 * duplicate Activity.RESULT_* and Settings.ADD_WIFI_RESULT_* by value for the
 * same reason; both are stable public API values (API 30).
 *
 * Unknown and missing codes deliberately fail CLOSED. Claiming success when the
 * network was not saved sends a student to campus with wi-fi that never
 * connects and no reason to suspect setup; the opposite mistake self-corrects,
 * because a retry over a network that did save returns ALREADY_EXISTS.
 */
final class EduroamOutcome {

    /** Activity.RESULT_OK */
    static final int RESULT_OK = -1;
    /** Activity.RESULT_CANCELED — the student dismissed the system dialog. */
    static final int RESULT_CANCELED = 0;

    /** Settings.ADD_WIFI_RESULT_SUCCESS */
    static final int ADD_WIFI_RESULT_SUCCESS = 0;
    /** Settings.ADD_WIFI_RESULT_ADD_OR_UPDATE_FAILED */
    static final int ADD_WIFI_RESULT_ADD_OR_UPDATE_FAILED = 1;
    /** Settings.ADD_WIFI_RESULT_ALREADY_EXISTS */
    static final int ADD_WIFI_RESULT_ALREADY_EXISTS = 2;

    private EduroamOutcome() {
    }

    static String outcome(int resultCode, List<Integer> perNetwork) {
        if (resultCode != RESULT_OK) {
            return "cancelled";
        }
        // Exactly one network is ever requested, so only the first code is meaningful.
        if (perNetwork == null || perNetwork.isEmpty() || perNetwork.get(0) == null) {
            return "failed";
        }
        switch (perNetwork.get(0)) {
            case ADD_WIFI_RESULT_SUCCESS:
                return "saved";
            case ADD_WIFI_RESULT_ALREADY_EXISTS:
                return "already-configured";
            case ADD_WIFI_RESULT_ADD_OR_UPDATE_FAILED:
            default:
                return "failed";
        }
    }

    /** Diagnostic string carried in `detail`; never shown raw to students. */
    static String detail(int resultCode, List<Integer> perNetwork) {
        return "resultCode=" + resultCode + " perNetwork="
                + (perNetwork == null ? "(none)" : perNetwork.toString());
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd android && ./gradlew testDebugUnitTest --tests 'cz.reis.app.EduroamOutcomeTest' -q 2>&1 | tail -15; cd ..
```
Expected: no failures printed (Gradle is quiet on success). To see the count: `cat android/app/build/test-results/testDebugUnitTest/TEST-cz.reis.app.EduroamOutcomeTest.xml | head -3` shows `tests="8" failures="0"`.

- [ ] **Step 5: Make the plugin resolve the neutral shape**

In `android/app/src/main/java/cz/reis/app/EduroamPlugin.java`, replace the whole `onAddResult` method (the last method in the class) with:

```java
    @ActivityCallback
    private void onAddResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        List<Integer> codes = null;
        if (result.getData() != null) {
            codes = result.getData().getIntegerArrayListExtra(Settings.EXTRA_WIFI_NETWORK_RESULT_LIST);
        }
        JSObject ret = new JSObject();
        // The neutral contract shared with the iOS plugin; see
        // src/mobile/configureEduroam.ts. The raw codes stay available in
        // `detail` for diagnostics.
        ret.put("outcome", EduroamOutcome.outcome(result.getResultCode(), codes));
        ret.put("detail", EduroamOutcome.detail(result.getResultCode(), codes));
        ret.put("identity", call.getData().optString("_identity"));
        ret.put("caSubject", call.getData().optString("_caSubject"));
        call.resolve(ret);
    }
```

The `List` import already exists in the file. No other change to the plugin.

- [ ] **Step 6: Compile the Android app to prove the plugin still builds**

Run:
```bash
cd android && ./gradlew assembleDebug -q 2>&1 | tail -10; cd ..
```
Expected: no errors. (`android/app/build/outputs/apk/debug/app-debug.apk` exists afterwards.)

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/cz/reis/app/EduroamOutcome.java android/app/src/test/java/cz/reis/app/EduroamOutcomeTest.java android/app/src/main/java/cz/reis/app/EduroamPlugin.java
git commit -m "feat(eduroam/android): resolve a platform-neutral outcome instead of raw intent codes

The iOS plugin has no Android result codes, so the contract the JS side
sees becomes { outcome, detail }. The mapping is a pure Java class under
JUnit; the fail-closed rule for unknown codes is preserved.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: TypeScript adopts the neutral contract

**Files:**
- Modify: `src/mobile/configureEduroam.ts` (whole file rewritten below)
- Modify: `src/mobile/__tests__/configureEduroam.test.ts` (whole file rewritten below)
- Modify: `src/hooks/data/__tests__/useEduroamSetup.test.ts` (the `onPhone` helper at lines 44–49 and the four native-path tests that call it)
- No change to `src/hooks/data/useEduroamSetup.ts` — it imports `configureEduroam` and `EduroamConfigOutcome`, both of which keep their names.

**Interfaces:**
- Consumes: the Android plugin's `{ outcome, detail }` from Task 1.
- Produces:
  ```ts
  export type EduroamConfigOutcome = 'saved' | 'already-configured' | 'failed' | 'cancelled';
  export interface NativeConfigureResult { outcome: string; detail?: string }
  export interface ConfigureEduroamDeps {
    configure(o: { p12Base64: string; caDerBase64: string; passphrase: string }): Promise<NativeConfigureResult>;
  }
  export function normalizeOutcome(result: NativeConfigureResult | null | undefined): EduroamConfigOutcome;
  export async function configureEduroam(material: EduroamNativeInput, deps: ConfigureEduroamDeps): Promise<EduroamConfigOutcome>;
  ```
  Task 3's `nativeEduroamDeps` implements `ConfigureEduroamDeps`.

- [ ] **Step 1: Rewrite the unit test for the neutral contract**

Replace the entire content of `src/mobile/__tests__/configureEduroam.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  configureEduroam,
  normalizeOutcome,
  type ConfigureEduroamDeps,
} from '../configureEduroam';

function material(over: Partial<Parameters<typeof configureEduroam>[0]> = {}) {
  return {
    // 0x30 0x82 — the DER SEQUENCE header every real cert and .p12 starts with.
    clientP12: new Uint8Array([0x30, 0x82, 0x01, 0x02]),
    rootCaDer: new Uint8Array([0x30, 0x82, 0x03, 0x04]),
    password: 'hunter2',
    ...over,
  };
}

function deps(over: Partial<ConfigureEduroamDeps> = {}): ConfigureEduroamDeps {
  return {
    configure: vi.fn(async () => ({ outcome: 'saved' })),
    ...over,
  };
}

describe('normalizeOutcome', () => {
  it.each(['saved', 'already-configured', 'cancelled', 'failed'] as const)(
    'passes %s through',
    (outcome) => {
      expect(normalizeOutcome({ outcome })).toBe(outcome);
    }
  );

  it('fails closed on an outcome string neither platform defines', () => {
    // Guessing "saved" would send the student to campus believing eduroam
    // works. The opposite mistake is self-correcting: a retry that actually
    // saved comes back already-configured, which reads as success.
    expect(normalizeOutcome({ outcome: 'ok' })).toBe('failed');
    expect(normalizeOutcome({ outcome: '' })).toBe('failed');
  });

  it('fails closed when the plugin resolved with no outcome at all', () => {
    expect(normalizeOutcome({} as never)).toBe('failed');
    expect(normalizeOutcome(null)).toBe('failed');
    expect(normalizeOutcome(undefined)).toBe('failed');
  });

  it('ignores detail — it is a diagnostic, not a signal', () => {
    expect(normalizeOutcome({ outcome: 'cancelled', detail: 'resultCode=0' })).toBe('cancelled');
  });
});

describe('configureEduroam', () => {
  it('hands the cert material across the bridge as base64', async () => {
    const d = deps();
    await configureEduroam(material(), d);
    expect(d.configure).toHaveBeenCalledWith({
      p12Base64: 'MIIBAg==',
      caDerBase64: 'MIIDBA==',
      passphrase: 'hunter2',
    });
  });

  it('returns the normalized outcome', async () => {
    const d = deps({ configure: vi.fn(async () => ({ outcome: 'already-configured' })) });
    await expect(configureEduroam(material(), d)).resolves.toBe('already-configured');
  });

  it('refuses to call native code when IS gave us no extraction password', async () => {
    // The passphrase is what opens the PKCS#12. Without it the keystore load
    // fails inside the plugin, which surfaces as an opaque native stage error —
    // so catch it here, where the cause is still legible.
    const d = deps();
    await expect(configureEduroam(material({ password: null }), d)).rejects.toThrow(
      /extraction password/i
    );
    expect(d.configure).not.toHaveBeenCalled();
  });

  it('propagates a native rejection instead of reporting a phantom success', async () => {
    const d = deps({
      configure: vi.fn(async () => {
        throw new Error('FAILED at stage=keystore: wrong password');
      }),
    });
    await expect(configureEduroam(material(), d)).rejects.toThrow(/stage=keystore/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/mobile/__tests__/configureEduroam.test.ts`
Expected: FAIL — `normalizeOutcome` is not exported (and TypeScript complains about `outcome`).

- [ ] **Step 3: Rewrite `configureEduroam.ts`**

Replace the entire content of `src/mobile/configureEduroam.ts` with:

```ts
// JS side of the native eduroam Wi-Fi setup (Android and iOS).
//
// The student's cert material is fetched in the WebView, which holds the IS
// session (src/api/eduroam.ts), and crosses the bridge as base64. A .p12 is a
// few KB, so bridge size is a non-issue.
//
// Both native halves — android/.../EduroamPlugin.java and
// native/capacitor-eduroam/.../EduroamPlugin.swift — resolve the same neutral
// shape, so nothing here knows about Android intent codes or
// NEHotspotConfigurationError values. Each platform maps its own.

import { bytesToBase64 } from '../services/eduroam/base64';

export type EduroamConfigOutcome = 'saved' | 'already-configured' | 'failed' | 'cancelled';

const OUTCOMES: readonly string[] = ['saved', 'already-configured', 'failed', 'cancelled'];

/** What either native plugin resolves with. `detail` is a diagnostic, never shown raw. */
export interface NativeConfigureResult {
  outcome: string;
  detail?: string;
}

export interface ConfigureEduroamDeps {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeConfigureResult>;
}

/** What the caller passes in — the subset of `EduroamCertMaterial` this needs. */
export interface EduroamNativeInput {
  clientP12: Uint8Array;
  rootCaDer: Uint8Array;
  password: string | null;
}

/**
 * Unknown and missing outcomes deliberately fail CLOSED. Claiming success when
 * the network was not saved sends a student to campus with wi-fi that never
 * connects and no reason to suspect setup; the opposite mistake self-corrects,
 * because a retry over a network that did save reads as already-configured.
 */
export function normalizeOutcome(
  result: NativeConfigureResult | null | undefined
): EduroamConfigOutcome {
  const outcome = result?.outcome;
  return typeof outcome === 'string' && OUTCOMES.includes(outcome)
    ? (outcome as EduroamConfigOutcome)
    : 'failed';
}

/**
 * Hand the cert material to the native plugin and report what the OS did.
 *
 * The EAP identity is NOT passed from here: Android reads the subject CN off
 * the client certificate it is already holding (`<login>@mendelu.cz`), and iOS
 * takes the identity from the certificate itself under EAP-TLS.
 */
export async function configureEduroam(
  material: EduroamNativeInput,
  deps: ConfigureEduroamDeps
): Promise<EduroamConfigOutcome> {
  if (!material.password) {
    // Checked here, where the cause is still legible. Inside the plugin this
    // surfaces as `FAILED at stage=keystore`, which says nothing about IS not
    // having shown a password on the certificate page.
    throw new Error('eduroam: IS did not provide the certificate extraction password');
  }

  const result = await deps.configure({
    p12Base64: bytesToBase64(material.clientP12),
    caDerBase64: bytesToBase64(material.rootCaDer),
    passphrase: material.password,
  });
  return normalizeOutcome(result);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/mobile/__tests__/configureEduroam.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Re-point the hook tests at the neutral shape**

In `src/hooks/data/__tests__/useEduroamSetup.test.ts`, replace the `onPhone` helper:

```ts
/** Put the hook on the phone, with the plugin answering `outcome`. */
async function onPhone(outcome: string) {
  const native = await import('../../../mobile/eduroamNative');
  vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(true);
  vi.mocked(native.nativeEduroamDeps.configure).mockResolvedValue({ outcome });
  return native;
}
```

Then change the four call sites:

| Test | Old call | New call |
|---|---|---|
| configures the network natively on the phone… | `await onPhone('0');` | `await onPhone('saved');` |
| treats an eduroam network that already exists as success | `await onPhone('2');` | `await onPhone('already-configured');` |
| returns to idle when the student dismisses the system dialog | `await onPhone('(none)', 0);` | `await onPhone('cancelled');` |
| surfaces a genuine add failure as an error | `await onPhone('1');` | `await onPhone('failed');` |

In the "returns to idle" test, replace the comment line `// RESULT_CANCELED revokes nothing, so the honest state is "not done yet" —` with `// A dismissed system dialog is a choice, so the honest state is "not done yet" —`.

- [ ] **Step 6: Run the hook tests and the interface type check**

Run: `npx vitest run src/hooks/data/__tests__/useEduroamSetup.test.ts && npm run typecheck`
Expected: 8 tests PASS; `tsc -b` exits 0. If `typecheck` reports `eduroamNative.ts` (the plugin interface still declares `Promise<NativeAddResult>`), that is expected — fix it there now with the minimal edit below, since the type no longer exists:

In `src/mobile/eduroamNative.ts` change the import and the interface to:
```ts
import type { ConfigureEduroamDeps, NativeConfigureResult } from './configureEduroam';

interface EduroamNativePlugin {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeConfigureResult>;
}
```

Re-run `npm run typecheck`. Expected: exit 0.

- [ ] **Step 7: Run the full unit suite and lint**

Run: `npm run test:run 2>&1 | tail -6 && npm run lint`
Expected: all tests pass; eslint exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/mobile/configureEduroam.ts src/mobile/__tests__/configureEduroam.test.ts src/hooks/data/__tests__/useEduroamSetup.test.ts src/mobile/eduroamNative.ts
git commit -m "refactor(eduroam): platform-neutral native result contract

The JS bridge reads { outcome, detail } from either native plugin and
keeps only the fail-closed rule; Android's intent codes now live in Java.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: iOS is a native host; the target comes from Capacitor

**Files:**
- Modify: `src/mobile/eduroamNative.ts` (whole file rewritten below)
- Create: `src/mobile/__tests__/eduroamNative.test.ts`

**Interfaces:**
- Consumes: `getPlatform()` from `src/platform/index.ts` (`kind: 'extension' | 'capacitor' | 'web'`); `Capacitor.getPlatform()` from `@capacitor/core` (`'ios' | 'android' | 'web'`).
- Produces:
  ```ts
  export type NativeEduroamTarget = 'ios' | 'android';
  export function nativeEduroamTarget(): NativeEduroamTarget | null; // null off Capacitor
  export function canConfigureEduroamNatively(target: string): boolean;
  export const nativeEduroamDeps: ConfigureEduroamDeps;
  ```
  Task 4's sheet calls `nativeEduroamTarget()` first in `detectTarget()`.

- [ ] **Step 1: Write the failing tests**

`src/mobile/__tests__/eduroamNative.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// registerPlugin must not touch a real bridge; Capacitor.getPlatform is what
// the target resolver reads.
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({ configure: vi.fn() })),
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));

vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'web' })),
}));

import { Capacitor } from '@capacitor/core';
import { getPlatform } from '../../platform';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../eduroamNative';

function host(kind: 'extension' | 'capacitor' | 'web', os: 'ios' | 'android' | 'web' = 'web') {
  vi.mocked(getPlatform).mockReturnValue({ kind } as never);
  vi.mocked(Capacitor.getPlatform).mockReturnValue(os);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canConfigureEduroamNatively', () => {
  it('admits both phone OSes inside the Capacitor app', () => {
    host('capacitor', 'ios');
    expect(canConfigureEduroamNatively('ios')).toBe(true);
    host('capacitor', 'android');
    expect(canConfigureEduroamNatively('android')).toBe(true);
  });

  it('never admits a desktop target, even inside the app', () => {
    host('capacitor', 'ios');
    expect(canConfigureEduroamNatively('mac')).toBe(false);
    expect(canConfigureEduroamNatively('windows')).toBe(false);
  });

  it('keeps the desktop→phone transfer in a browser: a phone target off Capacitor is a QR', () => {
    host('extension');
    expect(canConfigureEduroamNatively('ios')).toBe(false);
    expect(canConfigureEduroamNatively('android')).toBe(false);
    host('web');
    expect(canConfigureEduroamNatively('ios')).toBe(false);
  });
});

describe('nativeEduroamTarget', () => {
  it('reports the OS Capacitor is running on', () => {
    host('capacitor', 'ios');
    expect(nativeEduroamTarget()).toBe('ios');
    host('capacitor', 'android');
    expect(nativeEduroamTarget()).toBe('android');
  });

  it('is null off Capacitor, so callers fall back to the browser guess', () => {
    host('extension', 'ios');
    expect(nativeEduroamTarget()).toBeNull();
    host('web');
    expect(nativeEduroamTarget()).toBeNull();
  });

  it('is null when Capacitor itself says web (the dev shell)', () => {
    host('capacitor', 'web');
    expect(nativeEduroamTarget()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/mobile/__tests__/eduroamNative.test.ts`
Expected: FAIL — `nativeEduroamTarget` is not exported; the `'ios'` admission test fails.

- [ ] **Step 3: Rewrite `eduroamNative.ts`**

Replace the entire content of `src/mobile/eduroamNative.ts` with:

```ts
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import type { ConfigureEduroamDeps, NativeConfigureResult } from './configureEduroam';

interface EduroamNativePlugin {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeConfigureResult>;
}

/**
 * One JS name, two native halves: android/.../EduroamPlugin.java saves eduroam
 * via ACTION_WIFI_ADD_NETWORKS; native/capacitor-eduroam (Swift) via
 * NEHotspotConfigurationManager. Capacitor hands `registerPlugin` whichever
 * the OS provides, so nothing here branches on platform to pick one.
 */
const Eduroam = registerPlugin<EduroamNativePlugin>('Eduroam');

export const nativeEduroamDeps: ConfigureEduroamDeps = {
  configure: (o) => Eduroam.configure(o),
};

export type NativeEduroamTarget = 'ios' | 'android';

/**
 * The OS this app is running on, when it is the Capacitor app — or null in a
 * browser, where the eduroam target is the student's choice, not this device.
 *
 * Asked of Capacitor rather than guessed from the user agent: a WKWebView can
 * report itself as Macintosh, which the UA guess reads as a desktop Mac and
 * answers with a blob download the WebView does nothing useful with.
 */
export function nativeEduroamTarget(): NativeEduroamTarget | null {
  if (getPlatform().kind !== 'capacitor') return null;
  const os = Capacitor.getPlatform();
  return os === 'ios' || os === 'android' ? os : null;
}

/**
 * True when eduroam can be configured by the OS instead of by handing the
 * student a file.
 *
 * A phone target inside the Capacitor host is the whole test — reIS in a
 * desktop browser with the Android or iOS tab selected is a desktop→phone
 * transfer and must keep its QR.
 *
 * The Android API 30 floor is NOT checked here. minSdkVersion is 24, so Android
 * 7–10 devices reach this, and the plugin rejects them with an explicit message
 * rather than this returning a quiet false — a student on an old phone should
 * see why, not silently get a different flow. iOS 15.0/15.1 are handled the
 * same way inside the Swift plugin.
 */
export function canConfigureEduroamNatively(target: string): boolean {
  return (target === 'android' || target === 'ios') && getPlatform().kind === 'capacitor';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/mobile/__tests__/eduroamNative.test.ts src/hooks/data/__tests__/useEduroamSetup.test.ts`
Expected: PASS (6 + 8 tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

```bash
git add src/mobile/eduroamNative.ts src/mobile/__tests__/eduroamNative.test.ts
git commit -m "feat(eduroam): admit iOS as a native host and resolve the target from Capacitor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The sheet asks Capacitor, and tells iOS students the trade-off

**Files:**
- Modify: `src/components/mobile/sheets/EduroamSheet.tsx` (imports, `detectTarget`, one JSX line)
- Modify: `src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx` (mock block, `onPhone` helper, two new tests)
- Modify: `src/i18n/locales/cs.json` and `src/i18n/locales/en.json` (the `eduroam.native` block)
- Modify: `src/i18n/__tests__/eduroamWindowsKeys.test.ts` (add a `NATIVE_KEYS` check)

**Interfaces:**
- Consumes: `nativeEduroamTarget()` and `canConfigureEduroamNatively()` from Task 3.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing i18n key test**

In `src/i18n/__tests__/eduroamWindowsKeys.test.ts`, after the `DO_ONCE_DEVICES` constant add:

```ts
// Native-path keys used by the mobile sheet on Android and iOS.
const NATIVE_KEYS = [
  'button', 'working', 'saved', 'already', 'cancelled', 'failed', 'error',
  'privacyNote', 'iosLifetime',
] as const;
```

and inside the per-locale `describe(label, …)` block, after the `FLAT_KEYS` `it.each`, add:

```ts
      it.each(NATIVE_KEYS)('eduroam.native.%s is a non-empty string', (key) => {
        const v = leaf(dict, `eduroam.native.${key}`);
        expect(typeof v).toBe('string');
        expect((v as string).length).toBeGreaterThan(0);
      });

      it('native copy names no single OS — it is shared by Android and iOS', () => {
        for (const key of ['working', 'privacyNote'] as const) {
          expect(leaf(dict, `eduroam.native.${key}`)).not.toMatch(/Android/);
        }
      });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: FAIL — `iosLifetime` missing in both locales; `working` and `privacyNote` mention Android.

- [ ] **Step 3: Update the copy**

In `src/i18n/locales/en.json`, the `"native"` block under `"eduroam"` becomes:

```json
    "native": {
      "button": "Set up eduroam",
      "working": "Opening Wi-Fi setup…",
      "saved": "Done — eduroam is saved. You'll connect automatically on campus.",
      "already": "eduroam is already set up on this phone.",
      "cancelled": "Setup wasn't finished. Tap again to retry.",
      "failed": "Your device didn't save the eduroam network. Please try again.",
      "error": "eduroam setup didn't go through",
      "privacyNote": "The certificate never leaves your device — reIS hands it straight to the system.",
      "iosLifetime": "eduroam stays set up as long as reIS is installed."
    },
```

In `src/i18n/locales/cs.json`:

```json
    "native": {
      "button": "Nastavit eduroam",
      "working": "Otevírám nastavení Wi-Fi…",
      "saved": "Hotovo — eduroam je uložený. Na fakultě se připojíš automaticky.",
      "already": "eduroam už na tomto telefonu nastavený je.",
      "cancelled": "Nastavení nebylo dokončeno. Klepni znovu.",
      "failed": "Zařízení síť eduroam neuložilo. Zkus to prosím znovu.",
      "error": "Nastavení eduroamu se nepodařilo",
      "privacyNote": "Certifikát nikam neodchází — reIS ho předá rovnou systému.",
      "iosLifetime": "eduroam zůstane nastavený, dokud máte reIS nainstalovaný."
    },
```

(`failed` is also made OS-neutral because it is shown on both platforms; the existing sheet test that matched `/Android síť eduroam neuložil/` is updated in Step 6.)

- [ ] **Step 4: Run the i18n test to verify it passes**

Run: `npx vitest run src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing sheet tests**

In `src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx`:

Change the `eduroamNative` mock to:
```ts
vi.mock('../../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(false),
  nativeEduroamTarget: vi.fn().mockReturnValue(null),
}));
```

Import it alongside `canConfigureEduroamNatively`:
```ts
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../../mobile/eduroamNative';
```
and add after `mockedCanConfigureNatively`:
```ts
const mockedNativeTarget = vi.mocked(nativeEduroamTarget);
```

Replace the `onPhone` helper with one that takes the OS:
```ts
/** A phone running the Capacitor app, where the OS does the setup. */
function onPhone(over: Partial<HookState> = {}, os: 'android' | 'ios' = 'android') {
  mockedIsMobile.mockReturnValue(true);
  mockedIsMac.mockReturnValue(os === 'ios');
  mockedNativeTarget.mockReturnValue(os);
  mockedCanConfigureNatively.mockReturnValue(true);
  mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), target: os, ...over });
  useAppStore.setState({ language: 'cz' } as never);
}
```

Add these two tests before `it('closes via the header close button'`:

```ts
  it('takes the target from Capacitor, not the user agent — a WKWebView calling itself Macintosh is still iOS', () => {
    // The UA guess would read this device as a desktop Mac and hand it a blob
    // download the WebView does nothing useful with (#212).
    mockedIsMobile.mockReturnValue(false);
    mockedIsMac.mockReturnValue(true);
    mockedNativeTarget.mockReturnValue('ios');
    mockedCanConfigureNatively.mockReturnValue(true);
    mockedUseEduroamSetup.mockReturnValue({ ...baseHookState(), target: 'ios' });
    useAppStore.setState({ language: 'cz' } as never);

    render(<EduroamSheet onClose={vi.fn()} />);

    expect(mockedUseEduroamSetup).toHaveBeenCalledWith('ios');
  });

  it('tells iOS students that eduroam lives as long as reIS does, and Android students nothing of the sort', () => {
    // NEHotspotConfiguration networks are removed with the app; Android's
    // saved network is the student's own and survives. Say so only where true.
    onPhone({}, 'ios');
    render(<EduroamSheet onClose={vi.fn()} />);
    expect(screen.getByText(/dokud máte reIS nainstalovaný/)).toBeInTheDocument();
    cleanup();

    onPhone({}, 'android');
    render(<EduroamSheet onClose={vi.fn()} />);
    expect(screen.queryByText(/dokud máte reIS nainstalovaný/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Update the one test whose copy changed**

In the test `names the real failure when Android refuses the network`, change the assertion to:
```ts
    expect(screen.getByText(/Zařízení síť eduroam neuložilo/)).toBeInTheDocument();
```
and its title to `'names the real failure when the OS refuses the network'`.

- [ ] **Step 7: Run to verify the new tests fail**

Run: `npx vitest run src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx`
Expected: the two new tests FAIL (`useEduroamSetup` called with `'mac'`; lifetime text not found). Everything else passes.

- [ ] **Step 8: Change the sheet**

In `src/components/mobile/sheets/EduroamSheet.tsx`:

Change the import line
```ts
import { canConfigureEduroamNatively } from '../../../mobile/eduroamNative';
```
to
```ts
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../mobile/eduroamNative';
```

Replace `detectTarget` and its doc comment with:
```ts
/** Which eduroam profile to hand the student — there's no device picker here
 *  (unlike the desktop drawer): the device running this sheet *is* the device
 *  being set up. Inside the app Capacitor says which OS that is; the user-agent
 *  guess is only for a browser, where a WKWebView could otherwise read as a Mac. */
function detectTarget(): EduroamTarget {
  const native = nativeEduroamTarget();
  if (native) return native;
  if (isMobile()) return isMac() ? 'ios' : 'android';
  return isMac() ? 'mac' : 'windows';
}
```

Replace the trailing privacy-note block
```tsx
        {native && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.privacyNote')}</p>
        )}
```
with
```tsx
        {native && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.privacyNote')}</p>
        )}
        {/* iOS only: a network added through NEHotspotConfiguration is removed
            with the app. Android's saved network is the student's own and
            survives, so the sentence would be false there. */}
        {native && target === 'ios' && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.iosLifetime')}</p>
        )}
```

Also update the component doc comment's last paragraph from "Inside the Android app the first row disappears: Android saves the network itself…" to "Inside the app (Android or iOS) the first row disappears: the OS saves the network itself, so nothing is downloaded and no password is ever typed by a human. Two steps instead of three."

- [ ] **Step 9: Run the sheet tests, the whole suite, typecheck, lint**

Run: `npx vitest run src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx && npm run test:run 2>&1 | tail -6 && npm run typecheck && npm run lint`
Expected: all PASS; both tools exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/components/mobile/sheets/EduroamSheet.tsx src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx src/i18n/locales/cs.json src/i18n/locales/en.json src/i18n/__tests__/eduroamWindowsKeys.test.ts
git commit -m "feat(eduroam): sheet resolves the device from Capacitor; OS-neutral copy; iOS lifetime note

Closes the #212 root cause (UA guess) and discloses that an
NEHotspotConfiguration network is removed with the app.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The Swift plugin package and the entitlements

**Files:**
- Create: `native/capacitor-eduroam/package.json`
- Create: `native/capacitor-eduroam/Package.swift`
- Create: `native/capacitor-eduroam/ios/Sources/EduroamPlugin/EduroamPlugin.swift`
- Create: `native/capacitor-eduroam/README.md`
- Create: `ios/App/App/App.entitlements`
- Modify: `package.json` (dependencies)
- Modify: `ios/App/App.xcodeproj/project.pbxproj` (both `buildSettings` blocks that contain `CODE_SIGN_STYLE = Automatic;`, around lines 302 and 324)
- Modify: `ios/App/App/Info.plist` (one new key)
- Modify: `native/capacitor-secure-store/README.md` (one sentence)

**Interfaces:**
- Consumes: the JS call `Eduroam.configure({ p12Base64, caDerBase64, passphrase })` from Task 3.
- Produces: resolves `{ outcome: "saved" | "already-configured" | "cancelled" | "failed", detail?: String }` or rejects with `FAILED at stage=<stage>: <reason>`.

There is no Swift unit-test target; the "test" for this task is (a) `cap sync` registering the plugin, (b) a device-signed build carrying both entitlements, verified with `codesign`. Device behaviour is Task 6.

- [ ] **Step 1: Create the package manifest files**

`native/capacitor-eduroam/package.json`:
```json
{
  "name": "@reis/capacitor-eduroam",
  "version": "1.0.0",
  "private": true,
  "description": "iOS half of the native eduroam Wi-Fi setup (NEHotspotConfigurationManager). A local Capacitor plugin package, not published; the Android half is android/app/src/main/java/cz/reis/app/EduroamPlugin.java.",
  "license": "Apache-2.0",
  "capacitor": {
    "ios": {
      "src": "ios"
    }
  },
  "files": [
    "ios/Sources",
    "Package.swift"
  ]
}
```

`native/capacitor-eduroam/Package.swift`:
```swift
// swift-tools-version: 5.9
import PackageDescription

// Same shape as native/capacitor-secure-store: one plugin target under
// ios/Sources/<TargetName>. `cap sync` reads the package.json next to this file,
// scans that directory for `@objc(...)`, and generates BOTH the CapApp-SPM
// dependency and the packageClassList entry — the registration an app-local
// Swift file can never get.
// The package and product name are NOT free choices: `cap sync` derives them from
// the npm package name (`@reis/capacitor-eduroam` → `ReisCapacitorEduroam`). A
// mismatch fails at dependency resolution, before any Swift compiles.
let package = Package(
    name: "ReisCapacitorEduroam",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorEduroam",
            targets: ["EduroamPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "EduroamPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/EduroamPlugin")
    ]
)
```

- [ ] **Step 2: Write the plugin**

`native/capacitor-eduroam/ios/Sources/EduroamPlugin/EduroamPlugin.swift`:

```swift
import Capacitor
import Foundation
import NetworkExtension
import Security

/**
 * Configures MENDELU's eduroam as a Wi-Fi network from the student's own IS
 * certificate, through NEHotspotConfigurationManager. One tap in reIS, then
 * Join in iOS's own alert. The iOS half of android/.../EduroamPlugin.java.
 *
 * The recipe follows geteduroam's open-source iOS app (BSD-3), which does
 * EAP-TLS with private institutional roots through this same API:
 *
 * 1. SecPKCS12Import opens the .p12 with the extraction password IS shows.
 * 2. The identity, its chain and the MENDELU root go into the keychain access
 *    group `<TeamID>.com.apple.networkextensionsharing` — the header for
 *    setIdentity / setTrustedServerCertificates says the API resolves them from
 *    exactly that group at authentication time. NEVER request persistent
 *    references (kSecReturnPersistentRef): iOS then rejects the profile as
 *    invalid EAP settings.
 * 3. Old reIS items are deleted first, so re-running after the 366-day renewal
 *    replaces the credential instead of leaving two identities to pick from.
 *
 * Every failure names its stage, mirroring the Android plugin: "rejected" is
 * only actionable if we know whether the PKCS#12, the keychain, the settings or
 * the system alert rejected it.
 *
 * Trade-off, disclosed in the sheet: a configuration added this way is removed
 * when reIS is deleted (Apple DTS, forums thread 719422).
 */
@objc(EduroamPlugin)
public class EduroamPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EduroamPlugin"
    public let jsName = "Eduroam"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
    ]

    private static let ssid = "eduroam"
    /// The anchor the working .mobileconfig has pinned since June. Matched
    /// against the RADIUS certificate's CN / DNSName; not Android's suffix rule.
    private static let trustedServerNames = ["aleph.mendelu.cz"]
    private static let identityLabel = "reIS eduroam identity"
    private static let chainLabel = "reIS eduroam chain"
    private static let rootLabel = "reIS eduroam root"
    private static let accessGroupSuffix = "com.apple.networkextensionsharing"

    private struct StageError: Error {
        let stage: String
        let reason: String
        var message: String { "FAILED at stage=\(stage): \(reason)" }
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let p12Base64 = call.getString("p12Base64"),
              let passphrase = call.getString("passphrase"),
              let caDerBase64 = call.getString("caDerBase64")
        else {
            call.reject("configure requires p12Base64, passphrase and caDerBase64")
            return
        }

        // iOS 15.0 and 15.1 reject any profile that pins server certificates
        // (Apple forums 688323, fixed in 15.2). Say so rather than silently
        // dropping root pinning.
        if #available(iOS 15.2, *) {
            // supported
        } else {
            call.reject("FAILED at stage=platform: iOS 15.0 and 15.1 cannot pin the MENDELU root; update iOS and try again")
            return
        }

        // The API requires the app in the foreground and presents a system alert.
        DispatchQueue.main.async {
            do {
                let configuration = try self.buildConfiguration(
                    p12Base64: p12Base64, passphrase: passphrase, caDerBase64: caDerBase64)
                NEHotspotConfigurationManager.shared.apply(configuration) { error in
                    self.finish(call, error: error)
                }
            } catch let e as StageError {
                call.reject(e.message)
            } catch {
                call.reject("FAILED at stage=unknown: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Building the configuration

    private func buildConfiguration(p12Base64: String, passphrase: String, caDerBase64: String) throws -> NEHotspotConfiguration {
        // decode
        guard let p12 = Data(base64Encoded: p12Base64), !p12.isEmpty else {
            throw StageError(stage: "decode", reason: "p12Base64 is not base64 or is empty")
        }
        guard let caDer = Data(base64Encoded: caDerBase64), !caDer.isEmpty else {
            throw StageError(stage: "decode", reason: "caDerBase64 is not base64 or is empty")
        }

        // keystore
        var rawItems: CFArray?
        let importStatus = SecPKCS12Import(
            p12 as CFData, [kSecImportExportPassphrase as String: passphrase] as CFDictionary, &rawItems)
        guard importStatus == errSecSuccess else {
            throw StageError(stage: "keystore", reason: "SecPKCS12Import returned OSStatus \(importStatus)")
        }
        guard let items = rawItems as? [[String: Any]], let first = items.first,
              let identityRef = first[kSecImportItemIdentity as String]
        else {
            throw StageError(stage: "keystore", reason: "the PKCS#12 contains no identity")
        }
        // CF types do not bridge through `as?`; the import dictionary's value is a
        // SecIdentity by contract, so the forced cast is the documented form.
        let identity = identityRef as! SecIdentity
        let chain = (first[kSecImportItemCertChain as String] as? [SecCertificate]) ?? []

        // ca
        guard let root = SecCertificateCreateWithData(nil, caDer as CFData) else {
            throw StageError(stage: "ca", reason: "root DER is not an X.509 certificate")
        }

        let group = try accessGroup()

        // clean
        deleteOurItems(group: group)

        // keychain
        try add([
            kSecValueRef as String: identity,
            kSecAttrLabel as String: Self.identityLabel,
        ], group: group, stage: "keychain", what: "identity")
        for cert in chain {
            try add([
                kSecClass as String: kSecClassCertificate,
                kSecValueRef as String: cert,
                kSecAttrLabel as String: Self.chainLabel,
            ], group: group, stage: "keychain", what: "chain certificate")
        }
        try add([
            kSecClass as String: kSecClassCertificate,
            kSecValueRef as String: root,
            kSecAttrLabel as String: Self.rootLabel,
        ], group: group, stage: "keychain", what: "root certificate")

        // The setters resolve keychain-backed references, so read both back.
        let storedIdentity: SecIdentity = try copyMatching([
            kSecClass as String: kSecClassIdentity,
            kSecAttrLabel as String: Self.identityLabel,
            kSecAttrAccessGroup as String: group,
            kSecReturnRef as String: true,
        ], stage: "keychain", what: "identity")
        let storedRoot: SecCertificate = try copyMatching([
            kSecClass as String: kSecClassCertificate,
            kSecValueRef as String: root,
            kSecAttrAccessGroup as String: group,
            kSecReturnRef as String: true,
        ], stage: "keychain", what: "root certificate")

        // eapSettings
        let eap = NEHotspotEAPSettings()
        eap.supportedEAPTypes = [NSNumber(value: NEHotspotEAPSettings.EAPType.EAPTLS.rawValue)]
        eap.isTLSClientCertificateRequired = true
        eap.trustedServerNames = Self.trustedServerNames
        guard eap.setIdentity(storedIdentity) else {
            throw StageError(stage: "eapSettings", reason: "setIdentity returned false (identity not resolvable in the access group)")
        }
        guard eap.setTrustedServerCertificates([storedRoot]) else {
            throw StageError(stage: "eapSettings", reason: "setTrustedServerCertificates returned false (root not resolvable in the access group)")
        }

        // apply — joinOnce stays false (unsupported for EAP anyway); no
        // lifeTimeInDays (does not apply to enterprise networks).
        return NEHotspotConfiguration(ssid: Self.ssid, eapSettings: eap)
    }

    // MARK: - Outcome mapping

    private func finish(_ call: CAPPluginCall, error: Error?) {
        guard let error = error else {
            call.resolve(["outcome": "saved"])
            return
        }
        let ns = error as NSError
        guard ns.domain == NEHotspotConfigurationErrorDomain else {
            call.resolve(["outcome": "failed", "detail": "\(ns.domain) \(ns.code)"])
            return
        }
        switch ns.code {
        case NEHotspotConfigurationError.userDenied.rawValue:
            // The student tapped Cancel. A choice, not a fault.
            call.resolve(["outcome": "cancelled"])
        case NEHotspotConfigurationError.alreadyAssociated.rawValue:
            // The device is on eduroam right now.
            call.resolve(["outcome": "already-configured"])
        case NEHotspotConfigurationError.pending.rawValue:
            call.reject("FAILED at stage=apply: a previous eduroam request is still open")
        default:
            // invalidEAPSettings (4), internal (8), systemConfiguration (10),
            // unknown (11) and anything newer: a real failure, fail closed.
            call.resolve(["outcome": "failed", "detail": "NEHotspotConfigurationError \(ns.code)"])
        }
    }

    // MARK: - Keychain helpers

    /// `<TeamID>.com.apple.networkextensionsharing`. The prefix comes from
    /// Info.plist's `AppIdentifierPrefix`, which Xcode expands from
    /// $(AppIdentifierPrefix) at build time — so it follows whichever team signs,
    /// and is never a constant in source.
    private func accessGroup() throws -> String {
        guard let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String,
              !prefix.isEmpty
        else {
            throw StageError(stage: "keychain", reason: "Info.plist has no AppIdentifierPrefix; see ios/App/App/Info.plist")
        }
        return prefix + Self.accessGroupSuffix
    }

    private func deleteOurItems(group: String) {
        let queries: [[String: Any]] = [
            [kSecClass as String: kSecClassIdentity, kSecAttrLabel as String: Self.identityLabel],
            [kSecClass as String: kSecClassCertificate, kSecAttrLabel as String: Self.chainLabel],
            [kSecClass as String: kSecClassCertificate, kSecAttrLabel as String: Self.rootLabel],
        ]
        for var q in queries {
            q[kSecAttrAccessGroup as String] = group
            // errSecItemNotFound is success: the caller asked for it to be gone.
            SecItemDelete(q as CFDictionary)
        }
    }

    /// SecItemAdd into the access group. `errSecDuplicateItem` is tolerated:
    /// the chain usually contains the root too, so the root add is a repeat.
    private func add(_ attributes: [String: Any], group: String, stage: String, what: String) throws {
        var attrs = attributes
        attrs[kSecAttrAccessGroup as String] = group
        attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(attrs as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem else {
            // -34018 errSecMissingEntitlement = keychain-access-groups lacks the
            // networkextensionsharing group; see ios/App/App/App.entitlements.
            throw StageError(stage: stage, reason: "SecItemAdd(\(what)) returned OSStatus \(status)")
        }
    }

    private func copyMatching<T>(_ query: [String: Any], stage: String, what: String) throws -> T {
        var ref: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &ref)
        guard status == errSecSuccess, let value = ref else {
            throw StageError(stage: stage, reason: "SecItemCopyMatching(\(what)) returned OSStatus \(status)")
        }
        return value as! T
    }
}
```

- [ ] **Step 3: Write the package README**

`native/capacitor-eduroam/README.md`:

```markdown
# @reis/capacitor-eduroam

iOS half of the native eduroam Wi-Fi setup. Consumed by `src/mobile/eduroamNative.ts`
via `registerPlugin('Eduroam')`; the Android half of the same JS contract is
`android/app/src/main/java/cz/reis/app/EduroamPlugin.java`.

Local package, never published — `package.json` has `"private": true` and the app depends on
it as `file:native/capacitor-eduroam`. It is a package and not an app-target file for the
reason measured in `native/capacitor-secure-store/README.md`: Capacitor 8 registers iOS
plugins only from `packageClassList`, which `cap sync` builds from installed plugin packages.

## Contract

`configure({ p12Base64, caDerBase64, passphrase })` resolves
`{ outcome: 'saved' | 'already-configured' | 'cancelled' | 'failed', detail?: string }`
or rejects with `FAILED at stage=<decode|keystore|ca|keychain|eapSettings|apply|platform>: …`.

## Requirements the app must meet

- Entitlements (`ios/App/App/App.entitlements`): `com.apple.developer.networking.HotspotConfiguration`
  and `keychain-access-groups` containing `$(AppIdentifierPrefix)com.apple.networkextensionsharing`.
  Without the group, `SecItemAdd` fails with `-34018` (errSecMissingEntitlement).
- `Info.plist` key `AppIdentifierPrefix` = `$(AppIdentifierPrefix)`, which is how the plugin learns
  the team prefix for the access group without a hard-coded team ID.
- iOS 15.2+. On 15.0/15.1 the plugin rejects (platform bug with pinned server certificates).

## Behaviour worth knowing

- A network added through `NEHotspotConfigurationManager` is removed when the app is deleted.
  The sheet tells iOS students so (`eduroam.native.iosLifetime`).
- Re-running deletes the previous reIS keychain items first, so a renewed certificate
  replaces the old one in place.
- Design: `docs/superpowers/specs/2026-09-01-eduroam-ios-native-design.md`.
```

- [ ] **Step 4: Add the dependency and the entitlements**

In `package.json`, in `dependencies`, directly after the line
```json
    "@reis/capacitor-secure-store": "file:native/capacitor-secure-store",
```
add
```json
    "@reis/capacitor-eduroam": "file:native/capacitor-eduroam",
```
(keep alphabetical order if the file is sorted — `eduroam` sorts before `secure-store`, so place it *before* the secure-store line in that case.)

Create `ios/App/App/App.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.networking.HotspotConfiguration</key>
	<true/>
	<key>keychain-access-groups</key>
	<array>
		<string>$(AppIdentifierPrefix)com.apple.networkextensionsharing</string>
	</array>
</dict>
</plist>
```

Add the Info.plist key:
```bash
/usr/libexec/PlistBuddy -c 'Add :AppIdentifierPrefix string $(AppIdentifierPrefix)' ios/App/App/Info.plist && grep -A1 AppIdentifierPrefix ios/App/App/Info.plist
```
Expected output shows `<key>AppIdentifierPrefix</key>` followed by `<string>$(AppIdentifierPrefix)</string>`.

Wire the entitlements into both build configurations. In `ios/App/App.xcodeproj/project.pbxproj`, each of the two `buildSettings = {` blocks that contain `CODE_SIGN_STYLE = Automatic;` gets one new line directly before it:
```
				CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
```
Do it with one command (the pbxproj uses tabs):
```bash
perl -0pi -e 's/(\t\t\t\tCODE_SIGN_STYLE = Automatic;)/\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;\n$1/g' ios/App/App.xcodeproj/project.pbxproj && grep -c "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" ios/App/App.xcodeproj/project.pbxproj
```
Expected: `2`.

- [ ] **Step 5: Install and sync; verify registration**

```bash
npm install --no-audit --no-fund 2>&1 | tail -2 && npm run cap:sync 2>&1 | grep -E "capacitor-eduroam|Found .* plugins|error" ; grep -o '"EduroamPlugin"' ios/App/App/capacitor.config.json; grep -c ReisCapacitorEduroam ios/App/CapApp-SPM/Package.swift
```
Expected: the plugin list includes `@reis/capacitor-eduroam@1.0.0` (9 plugins), `"EduroamPlugin"` is printed once from `packageClassList`, and the Package.swift count is `2` (dependency + product). `package-lock.json` will change; commit it.

- [ ] **Step 6: Build for a device destination with both entitlements and verify them in the product**

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=RG38V3SV8X CODE_SIGN_STYLE=Automatic build 2>&1 \
  | grep -E "error:|BUILD (SUCCEEDED|FAILED)"
```
Expected: `** BUILD SUCCEEDED **` and no `error:` lines. If it fails with "Provisioning profile … doesn't include the keychain-access-groups entitlement", re-run once: the first run registers the Keychain Sharing capability on the App ID, the second picks up the regenerated profile. Then:

```bash
APP=$(ls -d ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphoneos/App.app | head -1)
codesign -d --entitlements :- "$APP" 2>/dev/null | grep -c -E "HotspotConfiguration|networkextensionsharing"
/usr/libexec/PlistBuddy -c 'Print :AppIdentifierPrefix' "$APP/Info.plist"
```
Expected: `2`, then `RG38V3SV8X.` (the prefix with its trailing dot — that dot is what makes the concatenation in Swift correct).

- [ ] **Step 7: Note the packaging rule's consequence in the secure-store README**

In `native/capacitor-secure-store/README.md`, replace the bullet
```
- The `Downloads` and `Eduroam` plugins are app-local Java today. That is fine on Android —
  `MainActivity.registerPlugin()` runs before the bridge initialises — but their iOS halves
  will need this same packaging. Do not start them as files in the app target.
```
with
```
- The `Downloads` plugin is app-local Java today. That is fine on Android —
  `MainActivity.registerPlugin()` runs before the bridge initialises — but its iOS half
  will need this same packaging. Do not start it as a file in the app target. The `Eduroam`
  iOS half already follows this rule: `native/capacitor-eduroam`.
```

- [ ] **Step 8: Format check, then commit**

```bash
npx prettier --check native/capacitor-eduroam/package.json native/capacitor-eduroam/README.md package.json && git status --short
```
Expected: prettier reports all files formatted; status shows only the intended files (`ios/App/App/capacitor.config.json` and `ios/App/App/public` are gitignored; `CapApp-SPM/Package.swift` is tracked and changed — commit it).

```bash
git add native/capacitor-eduroam package.json package-lock.json ios/App/App/App.entitlements ios/App/App/Info.plist ios/App/App.xcodeproj/project.pbxproj ios/App/CapApp-SPM/Package.swift native/capacitor-secure-store/README.md
git commit -m "feat(eduroam/ios): native one-tap setup via NEHotspotConfigurationManager

New local Swift plugin package registered under the shared JS name
'Eduroam'. Entitlements committed: HotspotConfiguration plus the
networkextensionsharing keychain group the API resolves identities from.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Device verification on campus, and the paper trail

**Files:**
- Create: `docs/superpowers/specs/2026-09-01-eduroam-ios-verification-checklist.md`
- Modify: `docs/app-store-listing.md` (§10 table row for App ID)

**Interfaces:**
- Consumes: the installed build from Task 5.
- Produces: a filled-in checklist committed to the repo; the closing evidence for issues #159 (iOS) and #212.

This task needs the developer physically present with the iPad on campus (they are, at the dorms). The subagent prepares the build and the checklist; the tap-through and the observations are the developer's, dictated back and recorded verbatim.

- [ ] **Step 1: Write the checklist document (unfilled)**

`docs/superpowers/specs/2026-09-01-eduroam-ios-verification-checklist.md`:

```markdown
# eduroam iOS native path — iPad verification checklist

**Status: ⏳ AWAITING ON-DEVICE TEST.** Tasks 1–5 of
`docs/superpowers/plans/2026-09-01-eduroam-ios-native.md` are committed. This document is
the procedure for the one gate that needs hardware: an iPad, on MENDELU campus, in range
of an `eduroam` access point. Fill in every `Observed:` line with what actually happened,
verbatim, including failures.

Device: iPad (8th generation, iPad11,6), iPadOS 26.6. Build: Debug, team RG38V3SV8X.
Bundle id used: `cz.reis.app` / `cz.reis.app.eduroam` (circle one — see Gate 0).

## Gate 0 — install

- [ ] If the old reIS 1.0 (free-team signed) is still on the iPad and still cannot be
      removed (ScreenZen), build with `PRODUCT_BUNDLE_IDENTIFIER=cz.reis.app.eduroam`; the
      explicit App ID is registered by `-allowProvisioningUpdates`. Otherwise use `cz.reis.app`.
- [ ] Build and install (commands in the plan, Task 6 Step 2). Observed:

## Gate 1 — the flow

1. [ ] Sign in, open Settings (profile sheet) → **eduroam**. The sheet shows two numbered
       rows, no password chip, no QR, the privacy note, and the iOS-only line "eduroam
       zůstane nastavený, dokud máte reIS nainstalovaný." Observed:
2. [ ] Tap **Nastavit eduroam**. iOS shows *"reIS" chce se připojit k síti Wi-Fi "eduroam"*
       (or English). Tap **Zrušit / Cancel**. The sheet shows the info banner "Nastavení
       nebylo dokončeno. Klepni znovu.", no error banner, button still offered
       (`cancelled`). Observed:
3. [ ] Tap again, tap **Připojit / Join**. The sheet shows the success banner
       (`saved`). Nastavení → Wi-Fi lists `eduroam`; within ~1 minute the iPad is
       connected to it and a page loads. **This is the self-signed-root answer and the
       association answer in one.** Observed:
4. [ ] Tap a third time while connected. Outcome `already-configured` ("eduroam už na
       tomto telefonu nastavený je."). Nastavení → Wi-Fi still shows ONE eduroam entry.
       Observed:
5. [ ] Delete the app. Nastavení → Wi-Fi: `eduroam` is gone from known networks
       (§7.1 of the design). Reinstall, sign in, run once more: `saved` again (the
       `clean` stage tolerated an empty keychain group). Observed:
6. [ ] Telemetry: in Supabase, `error_reports` has zero rows from this session's
       `p_session_id` window. Observed:

## If step 3 fails

- Rejected at `stage=keychain` with OSStatus -34018 → the keychain group is missing from
  the signed entitlements; `codesign -d --entitlements :- App.app` must list
  `networkextensionsharing`.
- `failed` with `detail = NEHotspotConfigurationError 4` after Join → invalid EAP settings;
  first suspect is a persistent reference having been requested (there must be none), second
  is the identity not resolving from the access group.
- `saved` but no association within a few minutes → iOS accepted the profile but the
  handshake failed; compare the pinned root and `aleph.mendelu.cz` against the working
  `.mobileconfig` (`src/services/eduroam/mobileconfig.ts`).

## Report back

Record the PASS/FAIL per step above, then update: issue #159 (iOS half — close if PASS),
issue #212 (close as superseded, with the entitlement finding), `docs/app-store-listing.md`
§10 (App ID capabilities).
```

- [ ] **Step 2: Build for the iPad and install**

Find the device ids:
```bash
xcrun xctrace list devices 2>/dev/null | grep -i ipad; xcrun devicectl list devices | grep -i ipad
```
Expected: one iPad line in each. The first gives the `xcodebuild -destination 'id=…'` UDID; the second the CoreDevice identifier for `devicectl`.

Build (use `PRODUCT_BUNDLE_IDENTIFIER=cz.reis.app.eduroam` as an extra argument only if Gate 0 says so):
```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'id=<xcodebuild-udid>' -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=RG38V3SV8X CODE_SIGN_STYLE=Automatic build 2>&1 \
  | grep -E "error:|BUILD (SUCCEEDED|FAILED)"
```
Expected: `** BUILD SUCCEEDED **`.

Install:
```bash
xcrun devicectl device install app --device <core-device-id> \
  "$(ls -d ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphoneos/App.app | head -1)"
```
Expected: `App installed:` with the bundle id.

Watch the plugin while the developer taps through (in a second terminal):
```bash
xcrun devicectl device process launch --device <core-device-id> --console cz.reis.app 2>&1 | grep -i -E "eduroam|FAILED at stage|NEHotspot" 
```
(Substitute the bundle id used. If `--console` is unavailable on this Xcode, skip: the sheet's banners are the observable.)

- [ ] **Step 3: Walk Gate 1 with the developer and record every `Observed:` line**

Ask the developer to perform steps 1–6 on the iPad and report what the screen shows at each step, word for word. Write the answers into the checklist file. Do not paraphrase a failure into a pass. If step 3 fails, stop, record it, and consult "If step 3 fails" — a fix is a code change back in Task 5, then rebuild and repeat from step 2.

- [ ] **Step 4: Update the status line and the App Store doc**

In the checklist, change the first line to `**Status: ✅ PASSED on device, <date>.**` (or `❌ FAILED at step N` with the observation) and fill "Bundle id used".

In `docs/app-store-listing.md` §10, change the App ID row
```
| App ID `cz.reis.app` | Registered, team **RG38V3SV8X**, no capabilities (the app declares no entitlements). |
```
to
```
| App ID `cz.reis.app` | Registered, team **RG38V3SV8X**. Capabilities: **Hotspot Configuration** and **Keychain Sharing** (group `com.apple.networkextensionsharing`), both for native eduroam setup — `ios/App/App/App.entitlements`, added 2026-09-01. |
```

- [ ] **Step 5: Commit the evidence**

```bash
git add docs/superpowers/specs/2026-09-01-eduroam-ios-verification-checklist.md docs/app-store-listing.md
git commit -m "docs(eduroam): iPad verification of the native iOS path, on campus

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Issue comments — confirm with the developer before posting**

Posting to GitHub is outward-facing. Show the developer the two comment drafts below and post only after an explicit yes.

Issue #159 (`gh issue comment 159 --body-file -`): a summary of the entitlement finding (paid team builds it), the geteduroam recipe, the checklist result per step, and the uninstall trade-off decision. Link the spec and the checklist by path.

Issue #212 (`gh issue comment 212 --body-file -` then `gh issue close 212 --reason "not planned"` only if the developer agrees): "Superseded by the native path — the entitlement gate measured on 2026-08-10 was the free team; on RG38V3SV8X it builds. The UA-guess root cause is fixed in `EduroamSheet.detectTarget` via `nativeEduroamTarget()`. Design: `docs/superpowers/specs/2026-09-01-eduroam-ios-native-design.md`."

---

## Self-review against the spec

- **§2 Why now** — measured facts; no task needed beyond recording them (Task 6 comments).
- **§3 Scope: in** — plugin package (T5), neutral contract (T1, T2), `'ios'` admission (T3), Capacitor target (T3, T4), copy (T4), entitlements (T5), checklist on campus (T6). **Out** items have no tasks, as intended.
- **§4.2 fail-closed rule** — T2 `normalizeOutcome` + tests; Android side T1 tests.
- **§5 every stage** — T5 Swift: decode, keystore, clean, keychain, eapSettings, apply, and the iOS 15.0/15.1 platform rejection; outcome table matches (`userDenied`→cancelled, `alreadyAssociated`→already-configured, `pending`→reject, else failed with detail). Team ID not hard-coded: Info.plist `$(AppIdentifierPrefix)` (spec §5 says "read at runtime from the app's own entitlement"; the Info.plist expansion is the supported way to read that value and is documented in the package README).
- **§6 entitlements** — T5 file content is exactly the spec's two keys; `CODE_SIGN_ENTITLEMENTS` in both configs; contingency bundle id in T6 Gate 0.
- **§7 copy** — T4: `working`, `privacyNote`, new `iosLifetime`; `already` unchanged. T4 additionally neutralises `failed` ("Android didn't save…" is shown on iOS too) — a small extension consistent with §7's intent, called out in the task.
- **§8 tests** — T2 (configureEduroam, hook), T3 (eduroamNative), T4 (sheet incl. lifetime line, i18n keys), T1 (Android JUnit). Checklist steps 1–6 in T6 match §8's six steps.
- **§9** — T6 Step 6 covers the issue trail, gated on the developer's yes.
- **Type consistency** — `NativeConfigureResult` / `normalizeOutcome` / `nativeEduroamTarget` / `canConfigureEduroamNatively` are named identically in T2, T3, T4 and the README; Swift resolves `outcome`/`detail` strings that `OUTCOMES` in T2 lists.
- **Placeholders** — none; every code step shows the code, every run step names the command and expected output.
