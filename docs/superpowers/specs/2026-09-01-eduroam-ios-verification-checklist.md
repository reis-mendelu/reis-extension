# eduroam iOS native path — iPad verification checklist

**Status: ✅ PASSED on device, 2026-09-01, on campus (dorms), steps 1–4.** Steps 5
(delete-app behaviour) and 6 (telemetry query) were **not run** — the developer called the
result a pass after step 4 and asked for the PR; both stay open below. Evidence for every
plugin answer is the app's own console, streamed over USB with
`xcrun devicectl device process launch --console --terminate-existing --device <id> cz.reis.app`,
which prints Capacitor's `To Native -> Eduroam configure` / `TO JS {...}` pairs. The
stream dies whenever the app is backgrounded (e.g. a trip to Settings), so it was restarted
before each attempt.

**Headline finding, not in the design:** `NEHotspotConfigurationError 10`
(`systemConfiguration`) is returned not only for a profile-owned network but also for an
`eduroam` the user saved themselves — the iPad had no profile installed (checked in
Nastavení → Obecné → VPN a správa zařízení) and the network's (i) page was a normal one,
yet apply() refused until the network was **forgotten**. Only then did apply() succeed.
Consequence for students: anyone who ever joined eduroam on that device by another route
must forget it first, and the sheet should say so instead of the generic red banner.
Tracked as a follow-up (§ "Report back").

Tasks 2–5 of `docs/superpowers/plans/2026-09-01-eduroam-ios-native.md` are committed. This
document is the procedure for the one gate that needs hardware: an iPad, on MENDELU campus,
in range of an `eduroam` access point.

Device: iPad (8th generation, iPad11,6), iPadOS 26.6. Build: Debug, team RG38V3SV8X.
Bundle id used: `cz.reis.app`.

## Gate 0 — install

- [x] Checked 2026-09-01 with `xcrun devicectl device info apps`: the iPad carries only
      reIS **5.0.6 (50006.1)**, bundle id `cz.reis.app`, signed by team RG38V3SV8X. The old
      free-team 1.0 that ScreenZen held in place on 2026-08-26 is gone, so the Debug build
      installs over 5.0.6 under the real bundle id; the `cz.reis.app.eduroam` contingency is
      not needed.
- [x] Build and install (commands in the plan, Task 6 Step 2). Observed: the
      `generic/platform=iOS` Debug product (signed `Apple Development`, team RG38V3SV8X, both
      entitlements present per `codesign -d --entitlements`) installed over TestFlight 5.0.6
      with `xcrun devicectl device install app` — "App installed: bundleID: cz.reis.app".
      Session restored from the Keychain; no re-login needed.

## Gate 1 — the flow

1. [x] Sign in, open Settings (profile sheet) → **eduroam**. The sheet shows two numbered
       rows, no password chip, no QR, the privacy note, and the iOS-only line "eduroam
       zůstane nastavený, dokud máte reIS nainstalovaný." Observed: sheet opened; the
       console shows the cert page, `root.der` (773 B) and `user-xholek1.p12` (2341 B)
       fetched over CapacitorHttp with HTTP 200 before every plugin call. Copy not read back
       word for word by the developer; the tap-through was driven by the banners.
2. [~] Tap **Nastavit eduroam**. iOS shows *"reIS" chce se připojit k síti Wi-Fi "eduroam"*
       (or English). Tap **Zrušit / Cancel**. The sheet shows the info banner "Nastavení
       nebylo dokončeno. Klepni znovu.", no error banner, button still offered
       (`cancelled`). Observed: the Join alert appeared on every attempt. The Cancel branch
       was **not exercised** separately — the developer tapped Join each time. `userDenied`
       mapping is covered by unit tests only.
3. [ ] Tap again, tap **Připojit / Join**. The sheet shows the success banner
       (`saved`). Nastavení → Wi-Fi lists `eduroam`; within ~1 minute the iPad is
       connected to it and a page loads. **This is the self-signed-root answer and the
       association answer in one.** Observed:
       - **Attempt 1 (23:02):** the iPad was already on eduroam through the June
         `.mobileconfig` profile. iOS showed its own *Unable to join the network "eduroam"*
         alert; the sheet showed the red `failed` banner. The app console
         (`devicectl … launch --console`) recorded the whole chain — cert page, `root.der`,
         `user-xholek1.p12`, `To Native -> Eduroam configure` — and the plugin's answer:
         `{"outcome":"failed","detail":"NEHotspotConfigurationError 10"}` =
         `systemConfiguration`: an app may not modify a network owned by a configuration
         profile. Correct fail-closed behaviour; not a plugin defect. Removing the profile and
         retrying is attempt 2 below. **Product finding:** a student who installed the reIS
         (or MENDELU's) profile on this device before will hit exactly this; the sheet should
         name it instead of showing the generic failure — tracked as a follow-up.
       - **Attempt 2 (23:05), profile removed:** still `{"outcome":"failed","detail":
         "NEHotspotConfigurationError 10"}`. VPN a správa zařízení listed **no** profiles;
         the eduroam (i) page was a normal known-network page (Zapomenout tuto síť present,
         no profile text). So error 10 also covers a user-saved network.
       - **Attempt 3, after Zapomenout tuto síť:** `{"outcome":"saved"}`; green banner;
         Nastavení → Wi-Fi showed the iPad **connected to eduroam** and web pages loaded.
         **PASS: MENDELU's self-signed root is accepted via `setTrustedServerCertificates`,
         and the iPad associates with a real eduroam AP.** Repeated once more by the
         developer (forget → tap → `saved` again, console line 297–298 of the fourth
         stream): reproducible.
4. [x] Tap a third time while connected. Outcome `already-configured` ("eduroam už na
       tomto telefonu nastavený je."). Nastavení → Wi-Fi still shows ONE eduroam entry.
       Observed: console `{"outcome":"already-configured"}` (NEHotspotConfigurationError 13,
       `alreadyAssociated`, mapped by the plugin); banner text confirmed by the developer.
       Single-entry check in Settings not read back.
5. [ ] Delete the app. Nastavení → Wi-Fi: `eduroam` is gone from known networks
       (§7.1 of the design). Reinstall, sign in, run once more: `saved` again (the
       `clean` stage tolerated an empty keychain group). Observed: **not run** (2026-09-01).
       The `clean`-on-empty-group path was exercised indirectly: attempt 3 ran after error-10
       attempts that had already written the identity, chain and root into the access
       group, and after a forgotten network — `SecItemDelete` + re-add succeeded.
6. [ ] Telemetry: in Supabase, `error_reports` has zero rows from this session's
       `p_session_id` window. Observed: **not run** (2026-09-01). Nothing in the console
       stream shows a `report_error_v2` call; the `failed` outcomes are resolved values, not
       thrown errors, so nothing routes to `logError`.

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

Steps 1, 3, 4 PASS; step 2's Cancel branch and steps 5–6 not run. Updated:
`docs/app-store-listing.md` §10 (App ID capabilities). Issues #159 / #212 are referenced
from the PR; closing comments are the developer's call.

**Follow-ups this run created**

- Map `NEHotspotConfigurationError 10` to its own outcome (e.g. `owned-elsewhere`) and give
  the sheet a sentence: "eduroam is already saved on this device by another route — forget
  it in Nastavení → Wi-Fi, then tap again." Today it is the generic red `failed` banner,
  which is what every student who joined eduroam manually before installing reIS will see.
- Run steps 5 and 6 when convenient.
