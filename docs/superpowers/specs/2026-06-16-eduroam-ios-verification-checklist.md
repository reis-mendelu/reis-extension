# eduroam iOS pipeline — iPad verification checklist

Run this once the migration + `eduroam-receive` edge function are deployed to the
`reis-notifications` Supabase project. Goal: a clear PASS that the desktop→iPad
zero-knowledge pipeline installs and connects, on a real iPad.

## Pre-req (deploy — one-time)
- [ ] Migration `eduroam_transfers` applied (table + `put_eduroam_transfer` /
      `take_eduroam_transfer` RPCs, RLS deny-all, anon `EXECUTE` on the two RPCs).
- [ ] Edge function `eduroam-receive` deployed with `verify_jwt = false`.
- [ ] Sanity: open `https://<ref>.supabase.co/functions/v1/eduroam-receive?id=test#test`
      in any browser → page loads and shows *"This profile link was already used or
      has expired"* (proves the page + RPC wiring work end to end).

## Stage A — generator installs on iPad (sanity, optional)
Confirms the generated `.mobileconfig` is iOS-valid, independent of the transfer.
- [ ] Generate a real profile (extension Mac tab download, or the env-gated
      `genRealProfile.test.ts`), password **not** embedded.
- [ ] AirDrop / Save-to-Files onto the iPad → tap → Settings → Profile Downloaded →
      Install → passcode → certificate password.
- [ ] iPad joins `eduroam` with working connectivity.

## Stage B — the full transfer pipeline (the real test)
- [ ] Load the rebuilt extension on the desktop; open eduroam → **iPhone / iPad** tab.
- [ ] Tap **Create QR code** → a QR appears (status "Scan this with your camera").
- [ ] On the iPad, open the **stock Camera**, point at the QR, tap the link →
      it opens in **Safari** (not an in-app browser).
- [ ] The page shows **"Profile decrypted on your device ✓"** and a
      **Download / Save to Files** button.
- [ ] Tap it → the `.mobileconfig` saves; open it (from the banner or Files) →
      Settings → Profile Downloaded → Install → passcode → certificate password
      (use the copy button in reIS) — **within ~8 minutes**.
- [ ] iPad joins `eduroam` with working connectivity.

> ⚠️ The one empirical unknown: whether mobile Safari reliably writes the
> in-browser-decrypted blob to Files. If the **Download / Save to Files** step
> fails or does nothing on the iPad, STOP and report it — that routes us to the
> fallback decision (server-serves-bytes), not a code fix.

## Security spot-checks
- [ ] In Supabase, `select id, left(payload,16), consumed, expires_at from
      eduroam_transfers` → `payload` is opaque base64 ciphertext only; row flips to
      `consumed = true` after the phone fetched it.
- [ ] Re-scan the **same** QR → the page reports already-used/expired (burn works).
- [ ] The AES key never appears in any Supabase request/log (it lives only in the
      QR fragment, which the phone never transmits).

## Report back
Note in the PR: QR scanned → decrypted on device → installed → joined eduroam;
whether the Files step was reliable; ciphertext-only confirmed; re-scan burned.
That is the "verified on iPad" signal the goal needs.
