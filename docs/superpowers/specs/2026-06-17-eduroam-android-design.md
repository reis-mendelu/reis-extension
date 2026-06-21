# Design — eduroam Android installer (geteduroam + `.eap-config`)

**Date:** 2026-06-17
**Status:** Approved — ready for implementation plan
**Scope:** Add an **Android** target to the eduroam tool. Generate an eduroam CAT
`.eap-config`, deliver it desktop→phone over the **existing** QR/Supabase transfer,
and let the official **geteduroam** app install it. Windows and Linux are out of
scope (later phases). macOS and iOS/iPadOS already ship and are verified.

---

## 1. Goal

A MENDELU student running reIS on their **desktop** sets up eduroam on their
**Android phone**. reIS cannot run on Android (no mobile extension), so the profile
is generated on the desktop and must *travel* to the phone and install there — the
same problem already solved for iOS, with a different file format and on-phone app.

**Definition of done = the developer installs and connects to eduroam on a real
Android phone through this pipeline, and explicitly confirms it ("verified on my
phone").** That confirmation is the gate; it is recorded in the PR.

---

## 2. Why geteduroam + `.eap-config` (decided 2026-06-17)

- **It is MENDELU's own official Android path.** `eduroam.mendelu.cz` already routes
  Android students through the geteduroam app — we match the supported flow rather
  than inventing one.
- **Android 11+ effectively requires it.** Manual EAP-TLS Wi-Fi configuration with a
  client certificate was removed/severely limited from the Android Settings UI;
  geteduroam (GÉANT, official, Play Store) is the realistic installer.
- **One format, future-proof.** The same `.eap-config` is consumed by geteduroam on
  **Windows** too, so this generator is the basis for the later Windows phase.

---

## 3. Hard constraints (inherited from Phase 1 / iOS)

- **Private key never leaves the device in plaintext.** The `.p12` carries the
  student's private key; we transfer only the password-protected `.p12` bytes,
  never the raw key.
- **`.p12` passphrase is NEVER embedded** (the load-bearing security property).
  `<Passphrase>` is omitted from the `.eap-config`; geteduroam prompts the student
  for it at import. The eduroam EAP-metadata schema makes `<Passphrase>` optional
  (`minOccurs="0"`), and geteduroam prompts when it is absent. An intercepted
  `.eap-config` is therefore an unopenable PKCS#12.
- **Server validation is never skippable.** The `<ServerID>` (`aleph.mendelu.cz`) +
  the embedded MENDELU root CA pin the RADIUS server; there is no
  "trust-any-server" escape hatch. Mirrors `TLSAllowTrustExceptions=false` on Apple.

---

## 4. The Android reality that shapes the on-phone step

Unlike iOS (a configuration-profile install prompt straight from a Safari
navigation), Android has **no OS-level "open this and install" prompt for Wi-Fi
profiles**. The flow is:

1. The QR carries a **URL** (a `.eap-config` is far too large for a QR).
2. The phone's camera/Chrome opens the URL; the `.eap-config` **downloads**.
3. The student **taps the downloaded file**; Android routes a file with extension
   `.eap-config` / MIME `application/eap-config` to **geteduroam** (if installed).
4. geteduroam imports the CA + client cert, **prompts for the passphrase**, builds
   the `eduroam` WLAN profile, and connects.

**Prerequisite:** geteduroam must be installed (Play Store). This is surfaced as an
explicit "step 0" with a store link in the desktop UI. This is the one extra step
Android has over iOS and it is unavoidable.

---

## 5. Architecture

```
DESKTOP (reIS extension iframe)                     ANDROID PHONE
──────────────────────────────                      ─────────────────────────────
1. fetchEduroamCertMaterial()              (reused, unchanged)
2. generateEapConfig() → .eap-config XML   (NEW; passphrase NOT embedded)
3. putTransfer(bytes) → id                 (reused; already format-agnostic)
4. QR = <receiver>?id=<id>&fmt=android
        │
        └──── scan with camera ───────────►  Chrome opens URL
                                              • eduroam-receive serves bytes with
                                                Content-Type application/eap-config,
                                                filename eduroam.eap-config
                                              • file downloads
                                              • tap → opens in geteduroam
                                              • geteduroam prompts for passphrase
                                              • imports CA + client cert + WLAN → joins
```

### 5.1 Components

| # | Component | File(s) | Change |
|---|---|---|---|
| 1 | Cert fetch | `src/api/eduroam.ts` | **reused, no change** |
| 2 | `.eap-config` generator (new, pure) | `src/services/eduroam/eapConfig.ts` (+ `.test.ts`) | **new** — sibling to `mobileconfig.ts`, reuses `base64.ts`, no plist |
| 3 | Transfer upload | `src/api/eduroamTransfer.ts` | `buildTransferUrl(id, fmt='ios')` gains an optional `fmt` arg; `putTransfer` unchanged (already just uploads base64 bytes) |
| 4 | Receiver edge function | `supabase/functions/eduroam-receive/index.ts` | reads `?fmt=`; maps `ios`→Apple MIME/`.mobileconfig` (default, unchanged), `android`→`application/eap-config`/`eduroam.eap-config` |
| 5 | Setup UI | `src/components/Eduroam/EduroamSetup.tsx` | **new third tab "Android"** |
| 6 | Android panel (new) | `src/components/Eduroam/AndroidTransfer.tsx` | mirrors `IosTransfer.tsx`: QR + Android steps + `PasswordChip` + geteduroam store link |
| 7 | Hook | `src/hooks/data/useEduroamSetup.ts` | `EduroamTarget` gains `'android'`; `run('android')` = fetch → `generateEapConfig` → `putTransfer` → QR via `buildTransferUrl(id,'android')` |
| 8 | i18n | `src/i18n/locales/{cs,en}.json` | Android tab + step strings |

No database/RPC/migration change. No new edge function. The iOS and macOS paths are
untouched (the `?fmt=` default is `ios`).

### 5.2 `.eap-config` generator spec

`generateEapConfig(input)` takes the same material as the mobileconfig generator
(`rootCaDer: Uint8Array`, `clientP12: Uint8Array`, optional `serverNames`,
`identity`, injectable id) and emits an `EAPIdentityProviderList` XML (eduroam EAP
metadata format) with:

- `<EAPMethod><Type>13</Type></EAPMethod>` — EAP-TLS.
- `<ServerSideCredential>` → `<CA format="X.509" encoding="base64">` = base64(root
  DER); `<ServerID>aleph.mendelu.cz</ServerID>` (from `serverNames`, default).
- `<ClientSideCredential>` → `<ClientCertificate format="PKCS12" encoding="base64">`
  = base64(client `.p12`). **No `<Passphrase>`.** Optional `<OuterIdentity>` /
  `<InnerIdentity>` = `login@mendelu.cz` if the cert CN is available; otherwise
  omitted (EAP-TLS does not require an explicit outer identity).
- `<CredentialApplicability><IEEE80211><SSID>eduroam</SSID>
  <MinRSNProto>CCMP</MinRSNProto></IEEE80211></CredentialApplicability>`.

The generator does **not** parse the cert bytes — it base64-embeds them (same
contract as `mobileconfig.ts`). Light input guards only (empty `rootCaDer` /
`clientP12` / `serverNames` throw). XML escaping is required on any string value;
reuse the escaping approach from `plist.ts` (a small local `escapeXml` is fine — do
not add a dependency). File stays < 200 lines, direct imports, no barrels.

> **Schema-exactness note:** the precise element nesting, namespace
> (`xmlns="..."`), and attribute names must match what geteduroam parses. The
> authoritative reference is the GÉANT CAT `eap-metadata.xsd` and a real
> letswifi/CAT `.eap-config` sample. The implementer validates the emitted XML
> against the XSD (or a captured real sample) in a unit test; the real-phone
> verification (§7) is the final proof that geteduroam accepts it.

### 5.3 Transfer reuse

- `putTransfer(bytes, ttl)` is unchanged — it uploads base64 of arbitrary bytes to a
  one-time, short-TTL row via `put_eduroam_transfer`. The `.eap-config` (a few KB)
  is well under the existing 100 000-char payload ceiling.
- `buildTransferUrl(id, fmt)` appends `&fmt=android` (or `fmt=ios`). The format hint
  is **not** a secret — it only selects the response MIME/filename; the bytes are
  identical regardless, and geteduroam validates the content itself.
- The receiver remains **non-burning** (short TTL is the protection; see the iOS
  pipeline notes). Re-scan after expiry returns the existing "already used or
  expired" message.

---

## 6. Out of scope

- **Windows** (also geteduroam + `.eap-config`, but delivered as a direct desktop
  download, not a QR transfer — next phase; this generator is its basis).
- **Linux**, and any non-geteduroam native Android path.
- Embedding `<Passphrase>` (only revisited if §7 shows geteduroam errors instead of
  prompting — a separate, deliberate decision).
- Any change to the iOS/macOS paths or the Supabase schema/RPCs.

---

## 7. Verification plan (the goal's DoD — on the developer's Android phone)

The one empirical unknown is **whether geteduroam prompts for the passphrase when
`<Passphrase>` is omitted** (evidence says yes; the phone proves it).

1. Load the rebuilt extension on the desktop; open eduroam → **Android** tab.
2. Ensure geteduroam is installed on the phone (step 0 link).
3. Tap **Create QR code** → a QR appears.
4. On the phone, scan the QR with the camera → Chrome opens → `.eap-config`
   downloads.
5. Tap the download → it opens in **geteduroam** → geteduroam **prompts for the
   certificate passphrase** (copy button in reIS) → import succeeds.
6. Phone joins `eduroam` with working connectivity.
7. Security spot-checks: the upload never contains the passphrase; re-scanning the
   expired/used QR returns the "already used or expired" message.

**PASS = the developer explicitly confirms "verified on my phone."** If step 5 fails
(geteduroam errors on a missing passphrase, or won't open the file), report exactly
what was seen; the fallback (embed `<Passphrase>`, rely on short TTL + one-time
transfer) is a separate decision, not part of this spec.

---

## 8. References

- iOS pipeline (the reused transport): `docs/superpowers/specs/2026-06-16-eduroam-ios-pipeline-design.md`
- Phase 1 generator (the sibling pattern): `docs/superpowers/specs/2026-06-16-eduroam-mobileconfig-generator-design.md`
- eduroam EAP metadata schema (`<Passphrase>` optional, `ClientCertificate` PKCS12):
  GÉANT CAT `eap-metadata.xsd` — https://wiki.geant.org/display/GWP5/EAP+metadata
- geteduroam `.eap-config` example (maintainer, no embedded passphrase):
  https://lists.geant.org/sympa/arc/geteduroam/2024-06/msg00001.html
- MENDELU Android guides (geteduroam is the official path):
  https://eduroam.mendelu.cz/navody-k-instalaci/25359-navody-pro-android
- Verified cert facts (root CA, `aleph.mendelu.cz`, p12 internals): memory
  `eduroam-cert-installer-facts`.
