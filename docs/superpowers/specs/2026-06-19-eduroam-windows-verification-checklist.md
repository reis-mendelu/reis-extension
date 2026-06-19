# eduroam Windows — on-device verification checklist

**DoD:** the developer connects to eduroam on a real Windows PC through this pipeline
and explicitly confirms it ("verified on my Windows"). There is **no host detection** —
the Windows segment is always available, the download is never gated, and the panel
links only our geteduroam download (never the MENDELU guide). The geteduroam install +
RADIUS join can only be proven on real Windows.

1. [ ] Build the extension (`npm run build`) and load it on a Windows PC; open eduroam → click the **Windows** segment.
2. [ ] The geteduroam download link (step 0) points to https://www.geteduroam.app/ ; install geteduroam for Windows.
3. [ ] Click **Download eduroam profile** → `eduroam-reis.eap-config` lands in Downloads (no QR shown).
4. [ ] Double-click the file → it opens in **geteduroam** (file association).
5. [ ] geteduroam **prompts for the certificate password** → paste the chip value → import succeeds.
6. [ ] The PC joins `eduroam` with working connectivity.
7. [ ] Security: open `eduroam-reis.eap-config` in a text editor → it contains **no** `<Passphrase>` element; the embedded `<ClientCertificate>` is an unopenable PKCS#12 without the password.
8. [ ] Footer note on the Windows segment reads the **local** copy (no "transfer link expires" sentence).

**PASS = developer writes "verified on my Windows" in the PR.** If step 5 fails
(geteduroam errors on the missing passphrase), record exactly what was seen; embedding
`<Passphrase>` is a separate decision (and discouraged — the file lingers on disk).
