# eduroam Android pipeline — phone verification checklist

**Status: ⏳ AWAITING ON-DEVICE TEST.** All 6 code tasks are committed on
`feat/eduroam-mobileconfig` and 37 eduroam unit tests pass. The two remaining gates
are operator actions: (1) deploy the `eduroam-receive` change, (2) verify on a real
Android phone and record the PASS below. This doc is the procedure for gate (2).

Goal: a clear PASS that the desktop→Android pipeline delivers a `.eap-config`,
geteduroam consumes it, prompts for the certificate password, and the phone joins
`eduroam`.

## Model: QR transfer → geteduroam (Android has no reIS extension)
Desktop reIS generates the `.eap-config` (EAP-TLS, EAP-metadata XML) → uploads to a
one-time short-TTL `eduroam_transfers` row → QR points at the `eduroam-receive`
endpoint with `?fmt=android` → endpoint serves the bytes as
`Content-Type: application/eap-config`, filename `eduroam.eap-config` → Android opens
it in **geteduroam**, which prompts for the client-cert password (never embedded).

## Gate 1 — deploy the receiver change (PREREQUISITE, operator action)
The `?fmt=android` MIME/filename branch is committed but **not deployed**. Until it
is live, an Android QR scan hits the old function and is served the Apple config MIME
instead of `.eap-config`.

- [ ] Deploy: `supabase functions deploy eduroam-receive --project-ref zvbpgkmnrqyprtkyxkwn --no-verify-jwt`
- [ ] Smoke check: put a transfer (extension Android tab Generate), then
      `GET <eduroam-receive>?id=<id>&fmt=android` returns `200` with
      `Content-Type: application/eap-config` and
      `Content-Disposition: attachment; filename="eduroam.eap-config"`.
- [ ] iOS regression: a `fmt=ios` (or no-`fmt`) GET still returns
      `application/x-apple-aspen-config` — the iOS path is untouched.

## Gate 2 — the transfer pipeline on a real Android phone (the real test)
- [ ] Install **geteduroam** from the Play Store
      (`app.eduroam.geteduroam`) on the phone, before scanning.
- [ ] Load the rebuilt extension on the desktop; open eduroam → **Android** tab.
- [ ] Tap **Generate** → a QR appears, and the certificate password is shown
      (copy button in reIS).
- [ ] On the phone, scan the QR (stock camera or QR scanner) → tap the link →
      `eduroam.eap-config` downloads.
- [ ] Open the downloaded file → it opens in **geteduroam** (not a browser, not a
      generic file viewer).
- [ ] geteduroam **prompts for the certificate password** → paste the password reIS
      showed → it imports the profile.
- [ ] Phone joins `eduroam` with working connectivity.

> ⚠️ The one empirical unknown: whether geteduroam **prompts** for the password when
> `<Passphrase>` is absent from the `.eap-config` (XSD `minOccurs=0`, so it should),
> or whether it **errors**. If it errors instead of prompting, report exactly what
> you saw — the fallback is to embed `<Passphrase>` (a separate, deliberate decision).

## Security spot-checks
- [ ] Re-scan the **same** QR → endpoint returns "already used or expired" (burn works).
- [ ] In Supabase, `select id, consumed, expires_at from eduroam_transfers` → the row
      is `consumed = true` after the phone fetched it.
- [ ] The `.p12` / cert password is never in the upload (typed into geteduroam only).
- [ ] The intercepted `.eap-config`, without the password, cannot be used to join
      (the PKCS#12 client cert stays password-protected).

## Report back
Note here (and in the PR): QR scanned → `.eap-config` downloaded → opened in
geteduroam → prompted for password → joined eduroam; re-scan burned. That is the
"verified on my own phone" consent the goal requires.

PASS recorded by: __________  date: __________
