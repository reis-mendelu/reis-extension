# Design — eduroam iOS / iPadOS installer + desktop→phone transfer pipeline (Phase 2)

**Date:** 2026-06-16
**Status:** ⚠️ SUPERSEDED IN PART — shipped & verified, but the model below changed.
**Scope:** Get the existing eduroam `.mobileconfig` onto an iPhone/iPad from the
desktop extension and installed.

> **⚠️ This document records the ORIGINAL zero-knowledge direction, which was
> abandoned during implementation. Read this banner before trusting §3.1, §4, and §5.**
>
> **What actually shipped (the authoritative description is the verification
> checklist `2026-06-16-eduroam-ios-verification-checklist.md` + memory
> `eduroam-ios-pipeline-deployment`):**
> - **NOT zero-knowledge.** The desktop uploads the assembled (password-protected)
>   `.mobileconfig` to a one-time, short-TTL Supabase row; the QR points straight at
>   the `eduroam-receive` edge function, which **serves the profile bytes** with
>   `Content-Type: application/x-apple-aspen-config` so iOS shows the **install
>   prompt directly** — no in-browser decrypt, no Files hop.
> - **No `transferCrypto.ts`.** The AES-256-GCM fragment-key crypto in §4.2 was
>   never shipped (and the file was deleted). The QR carries no key fragment.
> - **The read is NON-BURNING** (migration `20260617120000`), not "return-once-then-
>   burn" as §4.3 says: iOS double-fetches a config-profile URL (preflight + real
>   install), so a first-read burn 404'd the install. Security now rests on the
>   short TTL + the password-protected `.p12` (passphrase never uploaded/embedded,
>   typed at install). The `consumed` column is vestigial.
> - **Why the pivot:** iOS will not install a `.mobileconfig` from in-browser
>   (`blob:`) bytes, and Supabase Edge Functions rewrite `text/html` to
>   `text/plain`+`nosniff` (anti-phishing), which killed serving a decrypt *page*
>   from Supabase. Serving the profile bytes with the Apple MIME does work. The
>   developer accepted relaxing zero-knowledge for one-step UX (must work for
>   iPad-without-a-Mac users).
> - **Status:** deployed and **verified on a real iPhone, iPad, and Mac.**
>
> The sections below are retained for historical context (the rejected design and
> the iOS research that still holds). Treat §3 findings as accurate; treat the §3.1
> decision, §4 architecture, §4.2 crypto, §4.3 burn semantics, and §5 Stage B as
> **superseded** by the banner above.

---

## 1. Goal

A MENDELU student running reIS on their **desktop** (Windows-majority, sometimes
Mac) sets up eduroam on their **iPhone/iPad**. reIS cannot run on iOS (no mobile
extensions), so the profile is generated on the desktop and must *travel* to the
phone and install there.

Definition of done = **the developer installs and connects to eduroam on a real
iPad**, end-to-end through the pipeline below.

---

## 2. Hard constraints (from build handoff §5 + Phase-2 research)

- **Private key never leaves the device in plaintext.** The `.p12` carries the
  student's private key. We never POST the *raw* key anywhere.
- **`.p12` password is NEVER embedded** on a shared/transfer path. macOS prompts /
  the student types the university extraction password at install. This is the
  load-bearing security property: any intercepted profile is then just a
  PKCS#12 nobody can open. The generator already defaults to omitting it
  (`mobileconfig.ts`); for the transfer path the embed option is force-disabled.
- **`TLSAllowTrustExceptions=false`** stays hard-coded (server validation never
  skippable). Unchanged from Phase 1.

---

## 3. The iOS reality that shapes everything (verified, iOS 17/18)

Three findings from parallel research (UX / security / iOS-feasibility agents),
all converging:

1. **iOS will NOT install a `.mobileconfig` from in-page bytes.** A `blob:` or
   `data:` URL that JavaScript produced in the browser does **not** trigger the
   profile installer. iOS only installs a profile that arrives as a **real file**:
   either a Safari **server navigation** whose response is
   `Content-Type: application/x-apple-aspen-config`, **or** a file in
   **Files / AirDrop / Mail** that the user taps. Only **Safari and Mail** can hand
   a profile to the installer — Chrome/in-app webviews cannot.
2. **The install tail is identical for every delivery method** and is manual:
   **Settings → "Profile Downloaded" → Install → passcode → `.p12` password**,
   and the queued profile **auto-deletes after 8 minutes**.
3. **A QR cannot carry the file** (~3 KB max vs a 5–15 KB profile). The QR carries
   a **URL** only.

### 3.1 The three-way tension (and our resolution)

On iOS you cannot simultaneously have: (a) **zero-knowledge** (Supabase never sees
the plaintext profile), (b) **one-tap install**, and (c) **iOS** as target.
A clean one-tap requires the server to *serve the finished profile bytes* on a real
navigation — i.e. serve plaintext — which breaks zero-knowledge and handoff §5.

**Decision: keep zero-knowledge (the user's explicit design intent); accept one
extra hop on iOS.** The phone decrypts in-browser, **saves the profile into the
Files app**, and the student taps it there to install. Supabase only ever holds
ciphertext; the AES key lives only in the QR fragment. The one-tap-server-serves-
plaintext variant is **explicitly rejected**.

> **Empirical risk to verify on the iPad (Stage B):** whether mobile Safari
> reliably writes the in-browser-decrypted blob into Files. Blob download support
> has been flaky on some iOS builds. This is the single make-or-break unknown of
> the transfer path and is exactly what the iPad verification exists to resolve. If
> it proves unreliable, the fallback is a deliberate, separately-decided relaxation
> (server serves the password-protected profile bytes) — not part of this spec.

---

## 4. Architecture

```
DESKTOP (reIS extension iframe — secure context)        PHONE (iPad, stock Camera → Safari)
─────────────────────────────────────────────          ──────────────────────────────────
1. fetchEduroamCertMaterial()  (existing)
2. generateEduroamMobileconfig() → profile XML (existing; password NOT embedded)
3. transferCrypto.encrypt(profile)
     → { id, payload = iv‖ct‖tag, keyB64url }   (AES-256-GCM, Web Crypto)
4. POST {id, payload, expires_at} ─ ciphertext only ─►  Supabase  (eduroam_transfers, RLS deny-all)
5. render QR = https://<host>/t/<id>#<keyB64url>
        │
        └────────── scan with stock Camera ──────────►  opens URL in Safari
                                                          • read key from location.hash (never sent)
                                                          • GET ciphertext by id via Edge Function
                                                                (returns once, then burns)
                                                          • decrypt in-browser → profile XML
                                                          • save to Files (blob download)
                                                          • user taps file → Settings install
                                                          • types university .p12 password
```

### 4.1 Components

| # | Component | File(s) | Notes |
|---|---|---|---|
| 1 | Generator (existing) | `src/services/eduroam/mobileconfig.ts` | iOS-compatible already (shared payload types, no `PayloadScope`). Verify on iPad; no change expected. |
| 2 | Transfer crypto (new, pure) | `src/services/eduroam/transferCrypto.ts` (+ test) | `encryptProfile(bytes) → {id, payload, keyB64url}` and `decryptProfile(payload, keyB64url) → bytes`. AES-256-GCM via `crypto.subtle`. Pure, env-agnostic, TDD. |
| 3 | Transfer API (new) | `src/api/eduroamTransfer.ts` (+ test) | `putTransfer(id, payload, ttl)` → POST to Edge Function. No secrets returned. |
| 4 | Supabase storage + one-time read | `supabase/migrations/<ts>_eduroam_transfers.sql`, `supabase/functions/eduroam-transfer/` | Table `eduroam_transfers {id, payload, expires_at, consumed}`, RLS deny-all to anon; Edge Function: `POST` insert (rate-limited), `GET ?id=` return-once-then-burn ciphertext only; `pg_cron` purge. No server-side decrypt endpoint, ever. |
| 5 | Receiver page (new, phone-side) | `receiver/` (static, deployed to HTTPS host) | Reads `id`+`#key`, fetches ciphertext, decrypts, saves to Files + shows the iOS install steps. Web Crypto needs a secure context → must be HTTPS-hosted (Vercel or Supabase static). |
| 6 | Device-target UI | `src/components/Eduroam/EduroamSetup.tsx`, `useEduroamSetup.ts`, i18n | Currently gated to "is THIS host a Mac" — wrong axis. Offer **This Mac** vs **iPhone/iPad** regardless of desktop OS. iPhone path: generate → encrypt → POST → show QR + illustrated iOS steps. |
| 7 | QR rendering | new dep (`qrcode`) + small component | QR encodes the receiver URL. |

### 4.2 Crypto spec (transfer)

- AES-256-GCM, fresh 256-bit key + 96-bit IV per transfer (`crypto.subtle`).
- Stored payload = `iv ‖ ciphertext‖tag`. Key exported raw → base64url →
  **URL fragment only**. Never in path/query/body/header/logs.
- `id` = random UUID (122-bit), opaque lookup handle, safe in the path.
- Receiver page must **never transmit `location.hash`** (no analytics, no logging,
  no redirect carrying the fragment) and must be XSS-hardened — it holds the key in
  memory. (PrivateBin / one-time-secret fragment-key model.)

### 4.3 Supabase design

- `eduroam_transfers (id uuid pk, payload text/bytea, expires_at timestamptz, consumed bool default false)`.
- RLS enabled, **zero policies** for anon (deny-all direct access).
- Edge Function `eduroam-transfer` is the only reader/writer:
  - `POST` → validate size, insert with short TTL (default 8 min, matching iOS's
    profile-download window), server-side rate limit.
  - `GET ?id=` → if not consumed and not expired, return `payload` once and set
    `consumed=true`; else 404/410. **Ciphertext only.**
- `pg_cron` purges expired/consumed rows. Mirrors the existing
  `error_reports` RLS-deny + RPC pattern.

---

## 5. Verification plan (the goal's stage 3 — on the developer's iPad)

Two separable unknowns, tested in order so a failure is localized:

**Stage A — generator/install compatibility (no new pipeline needed):**
1. Developer generates a real profile via the existing flow (in-app tool or the
   env-gated `genRealProfile.test.ts`), with the password **not** embedded.
2. Gets it onto the iPad via AirDrop or Save-to-Files.
3. Installs (Settings → Profile Downloaded → … → types the university password).
4. iPad joins `eduroam` with working connectivity.
→ Proves the generated `.mobileconfig` is iOS-valid. (Expected: works unchanged.)

**Stage B — the transfer pipeline:**
1. Developer opens the iPhone/iPad path in the desktop extension → QR appears.
2. Scans with the iPad **stock Camera** → Safari opens the receiver page.
3. Receiver decrypts, saves the profile to Files.
4. Developer opens it from Files → installs → connects.
5. Confirms: Supabase row holds **only ciphertext**; re-scanning the burned QR
   fails; the key never appears in any server log/request.
→ Proves the end-to-end zero-knowledge pipeline **and** the iOS Files-hop.

A clear PASS on Stage B (or Stage A + a documented Stage-B blob-to-Files failure
that routes us to the fallback decision) is the "clear signal" the goal requires.

---

## 6. Out of scope

- The one-tap server-serves-plaintext variant (only revisited if Stage B's
  blob-to-Files step proves unreliable, as a separate decision).
- Android (`.eap-config` + geteduroam), Windows, Linux — later phases. The transfer
  pipeline (3+4+5) is reusable for Android later; only the payload and on-phone
  install step differ.
- CMS/PKCS#7 signing of the profile (ships unsigned; "Unverified" is expected).

---

## 7. References

- Phase 1 spec/plan: `docs/superpowers/specs|plans/2026-06-16-eduroam-mobileconfig-*`
- iOS install mechanism: Apple HT102400 (8-min window, Settings install), Apple
  Developer Forums 103337 (Safari/Mail-only profile handling).
- Fragment-key zero-knowledge pattern: PrivateBin / one-time-secret.
- Existing Supabase RLS-deny + gated-RPC pattern: `supabase/migrations/*error_reports*`.
