# eduroam iOS pipeline — iPad verification checklist

**Status: ✅ COMPLETE (2026-06-17).** Verified end-to-end on a real iPhone, iPad,
and Mac: QR → stock Camera → Safari → install prompt → installed → joined eduroam;
re-scan returned the expired/used message. This is the "verified on iPad" signal the
goal required. (Note: the pipeline is direct-install, **not** zero-knowledge — see
the corrected iOS pipeline design doc.) Retained as the record of how it was tested.

Goal: a clear PASS that the desktop→iPad pipeline installs and connects, on a real
iPad. The backend + transfer were deployed and proven; the on-device install is now
also confirmed.

## Model: direct install (UX-first, chosen 2026-06-16)
QR → stock Camera → Safari navigates to the `eduroam-receive` endpoint → it serves
the password-protected profile with `Content-Type: application/x-apple-aspen-config`
→ iOS shows the **install prompt directly** (no page, no decrypt, no Files hop).

## Deploy + backend — DONE (2026-06-16)
- [x] Migration `eduroam_transfers` (table + `put`/`take` burn RPCs, RLS deny-all).
- [x] Edge function `eduroam-receive` (`verify_jwt=false`) serves the profile bytes
      with the Apple config MIME, one-time.
- [x] **Verified live:** put via publishable key (204) → endpoint GET 200 with
      `application/x-apple-aspen-config` → 2nd GET burned (404).

So the desktop→upload→serve-with-MIME→burn chain is proven. The real iPad confirms
the on-device UX: scanning the QR triggers Safari → the install prompt directly.

## Stage A — generator installs on iPad (sanity, optional)
Confirms the generated `.mobileconfig` is iOS-valid, independent of the transfer.
- [ ] Generate a real profile (extension Mac tab download, or the env-gated
      `genRealProfile.test.ts`), password **not** embedded.
- [ ] AirDrop / Save-to-Files onto the iPad → tap → Settings → Profile Downloaded →
      Install → passcode → certificate password.
- [ ] iPad joins `eduroam` with working connectivity.

## Stage B — the transfer pipeline (the real test) ✅
- [x] Load the rebuilt extension on the desktop; open eduroam → **iPhone / iPad** tab.
- [x] Tap **Create QR code** → a QR appears.
- [x] On the iPad, open the **stock Camera**, point at the QR, tap the link →
      it opens in **Safari** (not an in-app browser).
- [x] Safari prompts **"This website is trying to download a configuration
      profile"** → **Allow**.
- [x] Open **Settings** → **"Profile Downloaded"** near the top (within ~8 min) →
      **Install** → passcode → **certificate password** (copy button in reIS).
- [x] iPad joins `eduroam` with working connectivity.

> ⚠️ The one empirical unknown: whether Safari shows the install prompt directly
> from the QR navigation. If Safari only downloads the file (no install prompt) or
> opens it in an in-app browser, report what you saw.

## Security spot-checks
- [ ] Re-scan the **same** QR → endpoint returns "already used or expired" (burn works).
- [ ] In Supabase, `select id, consumed, expires_at from eduroam_transfers` → the
      row is `consumed = true` after the phone fetched it (and `pg_cron` purges it).
- [ ] The `.p12` password is never in the upload (typed at install only).

## Report back
Note in the PR: QR scanned → Safari install prompt → installed → joined eduroam;
re-scan burned. That is the "verified on iPad" signal the goal needs.
