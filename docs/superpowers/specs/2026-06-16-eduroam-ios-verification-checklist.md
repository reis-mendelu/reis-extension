# eduroam iOS pipeline — iPad verification checklist

Goal: a clear PASS that the desktop→iPad zero-knowledge pipeline installs and
connects, on a real iPad. The backend + transfer are already deployed and proven;
only the on-device install remains.

## Deploy + backend — DONE (2026-06-16)
- [x] Migration `eduroam_transfers` applied (table + `put`/`take` burn RPCs,
      RLS deny-all, anon `EXECUTE` on the two RPCs).
- [x] Edge function `eduroam-receive` deployed (`verify_jwt=false`) as the JSON
      one-time ciphertext API.
- [x] Receiver page live at **https://receiver-henna.vercel.app** (public,
      `text/html`, runs the decrypt JS).
- [x] **Full automated round-trip verified live:** put via publishable key (204)
      → edge API (200) → decrypt matches original → re-fetch burned (404).
- [x] Stored row confirmed ciphertext-only + `consumed=true` (no plaintext server-side).

So the desktop→server→ciphertext→decrypt chain is proven. The two things a real
iPad still proves: (a) Safari renders the Vercel page + runs the decrypt, and
(b) iOS installs the decrypted profile from Files.

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
