# Design — eduroam `.mobileconfig` generator (Phase 1, macOS)

**Date:** 2026-06-16
**Status:** Approved — ready for implementation plan
**Scope:** Phase 1 only — a pure TypeScript generator that emits a working macOS
`.mobileconfig` for MENDELU eduroam. No UI, no UIS-session automation, no signing.

---

## 1. Goal

Produce a single function that takes the student's eduroam certificate material and
emits a valid macOS configuration profile installing, in one action:

1. MENDELU's root CA (to validate the RADIUS/EAP server),
2. the student's personal client identity (PKCS#12), and
3. an `eduroam` EAP-TLS Wi-Fi payload that references both.

Installing the emitted profile on a real Apple Silicon Mac must prompt once for the
`.p12` password, install both certs + the Wi-Fi profile, and auto-join `eduroam` with
full connectivity. No private key ever leaves the device.

This replaces MENDELU's ~25-slide manual guide for the macOS case.

---

## 2. Verified ground truth (resolved 2026-06-16)

All §4 unknowns from the build handoff were closed with real cert material from account
`xholek1` and the official current macOS guide. Investigation scripts and downloaded
certs live in `../reis-scraper/scripts/{investigate,download}-eduroam-cert*.ts` and
`../reis-scraper/eduroam-investigation/` (gitignored — private key material).

**UIS cert flow** (`https://is.mendelu.cz/auth/wifi/certifikat.pl`):
- Generate = `POST` with `lang=cz` + `gen=Vygenerovat certifikát`. **No CSRF token.**
- Download = authenticated GETs `?get=user-p12 | user-der | user-pem | user-p7b | root-der | root-pem`.
- The extraction password is printed in the page HTML in plaintext.
- (This confirms reIS can later drive the whole flow off the existing UIS session — but
  that automation is **out of scope for Phase 1**.)

**Cert internals:**
- Root CA: self-signed `CN=MENDELU, O=Mendel University, C=CZ`, valid 2009→2036,
  `CA:TRUE`. `root-der` and `root-pem` are the same cert in different encodings.
- Client cert: `CN=<login>@mendelu.cz`, issued **directly** by `CN=MENDELU` (no
  intermediate), EKU = TLS Web Client Auth, no SAN, 366-day validity.
- The `.p12` uses legacy PBE (RC2-40 + 3DES) — accepted natively by macOS Keychain.

**§4.1 — server validation (the highest-risk unknown), now SOLVED** via the official
macOS Ventura+ guide (`eduroam.mendelu.cz/.../35001-navod-pro-macos-ventura`, slide 17 =
the "Ověření certifikátu" dialog):
- Server (RADIUS/EAP) cert CN = **`aleph.mendelu.cz`**, issuer = **MENDELU**.
- → The **same MENDELU root signs both client and server.** One CA anchors both
  directions. `"faro"` is the account-access host, not the EAP cert — a red herring.
- Slide 14 (profile screen) confirms: network `eduroam`, **WPA2-Enterprise**,
  **EAP-TLS**, identity `login@mendelu.cz`.

**Resulting profile values:**

| Profile field | Value |
|---|---|
| `com.apple.security.root` payload | `base64(root-der)` |
| `com.apple.security.pkcs12` payload | `base64(user-<login>.p12)`, password key **omitted** |
| `PayloadCertificateAnchorUUID` (server CA) | the root payload's UUID (same MENDELU root) |
| `TLSTrustedServerNames` | `["aleph.mendelu.cz"]` |
| `AcceptEAPTypes` | `[13]` (EAP-TLS) |
| `EncryptionType` | `WPA` (= WPA2-Enterprise when EAP config present) |
| EAP identity | `login@mendelu.cz` (also the client cert CN) |
| `TLSAllowTrustExceptions` | `false` (hard-coded, never parameterized) |

---

## 3. Architecture

A pure, environment-agnostic TypeScript module under `src/services/eduroam/`. No
Node-only APIs (so it runs unchanged in the browser-bundled extension *and* in the
vitest/happy-dom test environment) and no new dependencies (hand-rolled plist + base64).

This is the eventual home: the project's security rule requires that the profile —
which embeds the student's private key — is assembled **entirely client-side in the
extension** and written only to the student's disk. A standalone script was rejected for
that reason.

### Module layout (each file < 200 lines, direct imports, no barrels)

| File | Responsibility |
|---|---|
| `types.ts` | `EduroamProfileInput` and options types |
| `base64.ts` | portable `Uint8Array → base64` (manual table; no `btoa`/`Buffer` assumption) |
| `plist.ts` | minimal plist serializer: `dict / array / data / string / integer / bool` → XML, with XML-escaping. Only the node types we emit. |
| `mobileconfig.ts` | `generateEduroamMobileconfig(input)` — builds the three payloads, wraps them in the top-level Configuration dict, serializes |

### Public API

```ts
interface EduroamProfileInput {
  rootCaDer: Uint8Array;            // MENDELU root (DER) — also the server anchor
  clientP12: Uint8Array;            // user-<login>.p12 bytes
  serverNames?: string[];           // default ["aleph.mendelu.cz"]
  displayName?: string;             // default "MENDELU eduroam (reIS)"
  identifier?: string;              // default "cz.reis.eduroam"
  uuids?: { top: string; ca: string; p12: string; wifi: string }; // injectable for tests
}

function generateEduroamMobileconfig(input: EduroamProfileInput): string;
```

- UUIDs: default to `crypto.randomUUID()` (available in browser and Node); injectable so
  tests are deterministic.
- The `.p12` password is **never** an input — omitted from the payload so macOS prompts
  at install time. This keeps the file from being a standalone credential.

### Data flow

1. Caller passes `rootCaDer` + `clientP12` (`Uint8Array`) + options.
2. Generator resolves four UUIDs (top, ca, p12, wifi).
3. Builds three payload dicts (root, pkcs12, wifi) per the table in §2.
4. Wraps them in the top-level `PayloadType=Configuration` dict.
5. Serializes the dict tree via `plist.ts` → returns the `.mobileconfig` XML string.

### Key invariants

- **One CA payload.** The Wi-Fi `PayloadCertificateAnchorUUID` references the root
  payload's UUID — client identity and server trust share the single MENDELU root.
- **`TLSAllowTrustExceptions = false`, hard-coded.** Server validation can never be
  skipped — getting this right *is* the security value of the tool.
- **No password embedded** in the pkcs12 payload.

### Error handling

Throw clear errors on: empty `rootCaDer`, empty `clientP12`, or empty `serverNames`.
Light input guards only — the module does not parse or validate the binary contents
(that is the OS's job at install time).

---

## 4. Testing (TDD — failing test first, per Iron Rules)

**Unit (vitest):**
- emitted output is a structurally valid plist (re-parse / assert required keys present);
- `base64` round-trips correctly against known vectors;
- plist XML-escaping is correct for special characters in string values;
- Wi-Fi anchor UUID equals the CA payload UUID (the one-root invariant);
- the pkcs12 payload has **no** password key;
- `TLSAllowTrustExceptions` is present and `false`; `TLSTrustedServerNames` matches input;
- injectable UUIDs produce a deterministic snapshot.

Fixtures are **synthetic** openssl-generated CA + client `.p12` (small, committed — no
real key material ever committed).

**Integration (macOS-gated, skips if `plutil` absent):**
- generate a profile from the real downloaded `root-der.der` + `user-p12.p12`, write it
  to a temp file, shell out to `plutil -lint` → must report OK.

**Manual definition-of-done (on the M3):**
1. Install the generated profile → prompts once for the `.p12` password (`wIp.num.7.uzo`)
   → installs root CA + client identity + Wi-Fi profile.
2. Mac auto-joins `eduroam` with full connectivity. (This also fixes "couldn't log into
   eduroam on Mac" — the cause was simply no client cert installed.)
3. Negative test: a deliberately-wrong `serverNames` value must **fail** to connect —
   proving server validation is actually enforced.
4. No private key leaves the device at any point.

---

## 5. Out of scope (Phase 1)

- Any UI (no React drawer/button, no extension wiring).
- UIS-session automation (fetching the `.p12` via `fetchWithAuth`, driving generation).
- CMS / PKCS#7 signing — ship unsigned; it installs fine, shown as "Unverified".
- iOS, Windows, Android, Linux (later phases).

---

## 6. References

- Build handoff (full Phase 1 spec): see conversation handoff doc.
- macOS guide slide 17 (server cert dialog): `eduroam.mendelu.cz/navody-k-instalaci/navody-pro-apple/35001-navod-pro-macos-ventura`
- Apple Wi-Fi payload schema (authoritative): `https://github.com/apple/device-management/blob/release/mdm/profiles/com.apple.wifi.managed.yaml`
- Investigation artifacts: `../reis-scraper/scripts/{investigate,download}-eduroam-cert*.ts`
