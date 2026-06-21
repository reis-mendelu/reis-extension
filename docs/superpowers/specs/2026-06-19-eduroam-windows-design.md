# Design — eduroam Windows installer (geteduroam + direct `.eap-config` download)

**Date:** 2026-06-19
**Status:** Approved (brainstorming) — ready for implementation plan
**Branch:** `feat/eduroam-mobileconfig`
**Scope:** Add a **Windows** target to the eduroam tool — the **last** platform. Reuse
the existing `.eap-config` generator, deliver it as a **direct desktop download** (no
QR, no Supabase transfer), and let the official **geteduroam Windows** app install it.
Linux remains out of scope.

> This was pre-decided by the Android spec: *"Windows (also geteduroam + `.eap-config`,
> but delivered as a direct desktop download, not a QR transfer — next phase; this
> generator is its basis)."* — `2026-06-17-eduroam-android-design.md` §6. This spec
> turns that one-liner into a concrete plan and adds the research that was missing.

---

## 1. Goal

A MENDELU student running reIS (the Chrome extension) **on their Windows PC** sets up
eduroam **on that same PC**. Because reIS *runs on Windows*, there is no desktop→phone
problem: the profile is generated locally and **saved straight to disk** — exactly the
Mac model, with a different file format and a different installer app.

**Definition of done = the developer installs and connects to eduroam on a real
Windows PC through this pipeline, and explicitly confirms it ("verified on my
Windows").** That confirmation is the gate; it is recorded in the PR. (Mirrors the
Android "verified on my phone" gate. The developer has a Windows machine and will
verify — confirmed during brainstorming.)

---

## 2. Why geteduroam + a direct `.eap-config` download (decided 2026-06-19)

- **The artifact already exists and is reusable unchanged.** `generateEapConfig()`
  (built for Android) emits an EAP-TLS (`<Type>13</Type>`) `EAPIdentityProviderList`
  with the MENDELU root CA + the student's PKCS#12, **no embedded passphrase**.
  geteduroam-Windows supports EAP-TLS, so the *same bytes* serve Windows.
- **geteduroam-Windows opens `.eap-config` by double-click.** The app registers a
  **file association** for `.eap-config` (geteduroam/windows-app issue #23, resolved),
  so downloading the file and double-clicking it opens it in geteduroam. Fallback if
  the association misfires: launch geteduroam → long-press the search icon → load the
  downloaded file.
- **Direct download, not QR.** reIS runs on the Windows PC, so `saveAs(...)` the file
  locally is the natural delivery — identical to how the Mac path saves the
  `.mobileconfig`. No Supabase row, no QR, no edge-function change.
- **Caveat (recorded honestly):** geteduroam is **not** MENDELU's *documented* Windows
  path — MENDELU's own Windows guides are a 25-screenshot manual import / their
  "Edusetup" tool and do not mention geteduroam. geteduroam is nonetheless GÉANT's
  official cross-platform installer and our config is standard EAP-TLS, so it is
  expected to work. The §7 on-Windows verification is exactly what closes this risk.

### Approaches considered (and rejected)

| Approach | Why not |
|---|---|
| **Link out to MENDELU's Windows guide** (no generation) | Breaks the polished in-app experience the other 3 platforms have; offers nothing reIS-specific. |
| **PowerShell / `netsh` WLAN installer** (no app install) | Complex to assemble client-side, unsigned scripts trip SmartScreen, and it duplicates what geteduroam already does safely. |
| **geteduroam + direct `.eap-config` download** (chosen) | Reuses the existing generator 100%, consistent with Android, double-click install. One extra "install geteduroam" step. |

---

## 3. Hard constraints (inherited from Phases 1–3)

- **Private key never leaves the device in plaintext.** Only the password-protected
  `.p12` bytes are embedded in the `.eap-config`; the file never leaves the machine
  (direct download).
- **`.p12` passphrase is NEVER embedded.** This is *more* important here than for
  Android: a direct-download file **lingers in the Downloads folder** with no
  short-TTL transfer protecting it, so an embedded passphrase would turn a leftover
  file into a usable standalone credential. `<Passphrase>` stays omitted; geteduroam
  prompts the student at import. An intercepted/leftover `.eap-config` is therefore an
  unopenable PKCS#12.
- **Server validation is never skippable** — `<ServerID>aleph.mendelu.cz</ServerID>`
  + the embedded MENDELU root CA pin the RADIUS server. (Already in the generator.)
- **Iron Rules:** DaisyUI semantic classes only, max 200 lines/file, direct imports,
  no `useEffect` data fetching, test-first.

---

## 4. The Windows reality that shapes the on-PC step

| | iOS | Android | **Windows (new)** |
|---|---|---|---|
| reIS runs on it? | No | No | **Yes** |
| Delivery | QR → Supabase transfer | QR → Supabase transfer | **Direct `saveAs` download** |
| Installer | OS config-profile prompt | geteduroam (Play Store) | **geteduroam (geteduroam.app `.exe`)** |
| Open the file | (automatic) | tap download | **double-click download** |
| Passphrase | typed at install | typed at import | **typed at import** |

**Prerequisite:** geteduroam must be installed first. Surfaced as an explicit "step 0"
with a download link, exactly like Android's Play-Store step 0. The official Windows
download is a direct `.exe` (Intel/AMD + ARM) from **https://www.geteduroam.app/** —
there is no Microsoft Store listing; link the architecture-detecting landing page, not
a raw `.exe`.

---

## 5. Architecture

```
WINDOWS PC (reIS extension iframe)
──────────────────────────────────
1. fetchEduroamCertMaterial()              (reused, unchanged)
2. generateEapConfig() → .eap-config XML   (reused, unchanged; passphrase NOT embedded)
3. saveAs(blob, "eduroam-reis.eap-config") (NEW path in the hook; application/eap-config)
        │
        └── student double-clicks the downloaded file
              • Windows file-association opens it in geteduroam
              • geteduroam prompts for the certificate passphrase (copy button in reIS)
              • imports CA + client cert, builds the eduroam WLAN profile → joins
```

No database / RPC / migration change. No edge-function change. No QR. The iOS / Android
/ Mac paths are untouched.

### 5.1 Components

| # | Component | File(s) | Change |
|---|---|---|---|
| 1 | Cert fetch | `src/api/eduroam.ts` | **reused, no change** |
| 2 | `.eap-config` generator | `src/services/eduroam/eapConfig.ts` | **reused, no change** |
| 3 | Hook | `src/hooks/data/useEduroamSetup.ts` | add `isWindows`; `EduroamTarget` gains `'windows'`; default target becomes `isWindows ? 'windows' : isMac ? 'mac' : 'ios'`; `run('windows')` = fetch → `generateEapConfig` → `saveAs(..., 'eduroam-reis.eap-config')` (MIME `application/eap-config`) |
| 4 | Windows panel (new) | `src/components/Eduroam/WindowsInstall.tsx` (+ test) | **new** — mirrors `MacInstall` (download gated on `isWindows` + cross-host hint) plus Android's geteduroam "step 0" link; vertical stepper after download |
| 5 | Drawer | `src/components/Eduroam/EduroamDrawer.tsx` | add the 4th segment; picker → **2×2 grid**; render `<WindowsInstall/>` for `target === 'windows'`; **per-path privacy note** (see §5.4) |
| 6 | i18n | `src/i18n/locales/{cs,en}.json` | new Windows keys + the split privacy-note keys (§5.4) |

### 5.2 Hook changes (`useEduroamSetup.ts`)

```ts
export type EduroamTarget = 'mac' | 'ios' | 'android' | 'windows';

export const isWindows =
  typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);

// default target
const [target, setTarget] = useState<EduroamTarget>(
  isWindows ? 'windows' : isMac ? 'mac' : 'ios',
);

// inside run(t), new branch — parallel to the Mac branch:
} else if (t === 'windows') {
  const eap = generateEapConfig({ rootCaDer, clientP12 });
  saveAs(new Blob([eap], { type: 'application/eap-config' }), 'eduroam-reis.eap-config');
}
```

The `'ios'` / `'android'` (QR) and `'mac'` (`.mobileconfig` download) branches are
unchanged. `password`/`status`/`error`/`reset` are reused as-is.

### 5.3 `WindowsInstall.tsx` (new)

Same prop shape as `MacInstall` minus the macOS-only `onOpenSettings` (Windows has no
deep link into geteduroam). `guideHref` keeps the **same meaning as in `MacInstall`** —
the MENDELU guide for the cross-host hint — and the geteduroam **download** link is a
**local module constant**, exactly like `AndroidTransfer`'s `GETEDUROAM_PLAY_URL`:

```ts
interface Props {
  status: EduroamStatus;
  password: string | null;
  guideHref: string;      // MENDELU guide — used only in the !isWindows hint (same as MacInstall)
  onDownload: () => void;
}

const GETEDUROAM_WINDOWS_URL = 'https://www.geteduroam.app/';  // step-0 download
```

Layout, mirroring `MacInstall` + `AndroidTransfer`:
- A geteduroam **install link** (step 0) above the download button, like Android's
  `getEduroam` link, pointing at `GETEDUROAM_WINDOWS_URL`.
- Download button: `btn btn-primary btn-lg`, **disabled unless `isWindows`**, with a
  `!isWindows` info alert + link to the MENDELU guide (mirrors `MacInstall`'s
  `!isMac` hint).
- After `status === 'done'`: an `alert-success` ("Profile downloaded") + a
  `steps steps-vertical` stepper:
  1. Install geteduroam first (link above).
  2. Double-click the downloaded **`eduroam-reis.eap-config`** → it opens in geteduroam.
  3. When geteduroam asks for the certificate password, enter: `<PasswordChip>`.
  4. Windows joins eduroam.
- A `Start over` ghost button calling `onDownload` (re-download), like the others.

Icon for the segment: `Monitor` from `lucide-react` (distinct from `Laptop`=Mac,
`Tablet`=Android, `Smartphone`=iOS).

### 5.4 Per-path privacy note (fixes a latent Mac bug)

Today `EduroamDrawer` renders one shared `eduroam.privacyNote` whose last sentence is
*"The transfer link is one-time and expires within minutes."* That is **only true for
the QR paths** (iOS/Android). It is already **wrong on Mac** (a direct download has no
transfer link) and would be wrong on Windows. Fix: split the note and choose by path.

- Rename the existing key `eduroam.privacyNote` → **`eduroam.privacyNoteTransfer`**
  (unchanged copy, used for `ios`/`android`).
- Add **`eduroam.privacyNoteLocal`** for `mac`/`windows`:
  *EN:* "Everything is generated on your device and your private key stays protected by
  a password only you enter on install."
  *CS:* "Vše se generuje ve vašem zařízení a váš soukromý klíč zůstává chráněn heslem,
  které zadáte jen vy při instalaci."
- In `EduroamDrawer`:
  ```tsx
  const isLocal = target === 'mac' || target === 'windows';
  <p className="text-xs text-base-content/40">
    {t(isLocal ? 'eduroam.privacyNoteLocal' : 'eduroam.privacyNoteTransfer')}
  </p>
  ```

### 5.5 Picker layout → 2×2 grid

The 3-segment single-row `join` becomes a 4-segment **2×2 grid** (chosen in
brainstorming — 4 buttons in one row truncate "iPhone / iPad" at 560px):

```tsx
const SEGMENTS = [
  { id: 'ios',     labelKey: 'eduroam.targetIos',     icon: Smartphone },
  { id: 'android', labelKey: 'eduroam.targetAndroid', icon: Tablet },
  { id: 'mac',     labelKey: 'eduroam.targetMac',     icon: Laptop },
  { id: 'windows', labelKey: 'eduroam.targetWindows', icon: Monitor },
];

<div role="tablist" className="grid grid-cols-2 gap-2">
  {SEGMENTS.map(({ id, labelKey, icon: Icon }) => (
    <button
      key={id}
      role="tab"
      aria-selected={target === id}
      className={`btn gap-2 ${target === id ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
      onClick={() => selectTarget(id)}
    >
      <Icon className="w-4 h-4" /> {t(labelKey)}
    </button>
  ))}
</div>
```

`role="tab"` + `aria-selected` are preserved (the existing drawer test relies on
them). `join`/`join-item` are dropped in favour of `grid grid-cols-2 gap-2`.

### 5.6 New i18n keys (both `cs.json` and `en.json`)

| Key | EN |
|---|---|
| `targetWindows` | `Windows` |
| `windowsHostHint` | `You're not on Windows — switch to your Windows PC to download here, or use another tab.` |
| `getEduroamWindows` | `Install the geteduroam app (geteduroam.app)` |
| `windowsDownloaded` | `Profile downloaded.` |
| `windowsStep0` | `Install the geteduroam app for Windows first (link above).` |
| `windowsStep1` | `Double-click the downloaded eduroam-reis.eap-config file to open it in geteduroam.` |
| `windowsStep2` | `When geteduroam asks for the certificate password, enter:` |
| `windowsStep3` | `geteduroam installs the profile and your PC joins eduroam.` |
| `privacyNoteLocal` | (see §5.4) |
| `privacyNoteTransfer` | (renamed from `privacyNote`, copy unchanged) |

(CS values authored alongside; "geteduroam" and "eduroam" are proper nouns kept as-is.)

---

## 6. Out of scope

- **Linux**, and any non-geteduroam native Windows path (manual `netsh`, MENDELU
  Edusetup, eduroam CAT `.exe`).
- Embedding `<Passphrase>` (only revisited if §7 shows geteduroam-Windows *errors*
  instead of prompting — a separate, deliberate decision; given the file lingers on
  disk, the bias is strongly against embedding).
- Any QR / Supabase transfer for Windows, any change to the iOS/Android/Mac paths
  beyond the shared picker + the privacy-note split, and any schema/RPC/edge change.
- A Microsoft Store listing (geteduroam ships a direct `.exe`; no Store link exists).

---

## 7. Verification plan (the goal's DoD — on the developer's Windows PC)

The empirical unknown is **whether geteduroam-Windows prompts for the passphrase when
`<Passphrase>` is omitted** (evidence says yes; the PC proves it). A separate
checklist doc (`2026-06-19-eduroam-windows-verification-checklist.md`) captures:

1. Build + load the extension on a Windows PC; open eduroam → **Windows** segment.
2. Install geteduroam for Windows from the step-0 link (`geteduroam.app`).
3. Click **Download eduroam profile** → `eduroam-reis.eap-config` lands in Downloads.
4. Double-click the file → it opens in **geteduroam**.
5. geteduroam **prompts for the certificate password** (copy button in reIS) → import
   succeeds.
6. The PC joins `eduroam` with working connectivity.
7. Security spot-checks: the downloaded file contains **no** `<Passphrase>`; opening
   the file without the password fails (it's an unopenable PKCS#12).

**PASS = the developer explicitly confirms "verified on my Windows."** If step 5 fails
(geteduroam errors on a missing passphrase, or won't open the file), report exactly
what was seen; the fallback is a separate decision, not part of this spec.

---

## 8. Testing

- **Generator:** `eapConfig.test.ts` / `eapConfig.xsd.test.ts` already cover the
  artifact — **no change** (Windows reuses the same bytes).
- **Drawer:** extend `EduroamDrawer.test.tsx` — assert a 4th `role="tab"` named
  /Windows/i appears and that clicking it sets `aria-selected="true"`; the existing
  open/close + segment-switch assertions stay green.
- **Windows panel (new):** `WindowsInstall.test.tsx` — renders the geteduroam link;
  download button disabled when `isWindows` is false (mock `navigator.userAgent`);
  the stepper + `PasswordChip` appear when `status === 'done'`.
- After all changes: `npm run typecheck` exit 0, `npm run test:run` all pass,
  `npm run build` exit 0 (standing user rule — confirm exit 0 before claiming done).

---

## 9. Files touched

- `src/hooks/data/useEduroamSetup.ts` (modify — `isWindows`, target, `run` branch)
- `src/components/Eduroam/WindowsInstall.tsx` (new)
- `src/components/Eduroam/__tests__/WindowsInstall.test.tsx` (new)
- `src/components/Eduroam/EduroamDrawer.tsx` (modify — 4th segment, 2×2 grid,
  per-path note)
- `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx` (modify — Windows segment)
- `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (modify — new keys + rename)
- `docs/superpowers/specs/2026-06-19-eduroam-windows-verification-checklist.md` (new,
  authored with the plan)

---

## 10. References

- Android design (the reused generator + the "Windows is next, direct download" call):
  `docs/superpowers/specs/2026-06-17-eduroam-android-design.md`
- iOS pipeline (the transfer the Windows path deliberately does *not* use):
  `docs/superpowers/specs/2026-06-16-eduroam-ios-pipeline-design.md`
- geteduroam Windows `.eap-config` file association: https://github.com/geteduroam/windows-app/issues/23
- geteduroam Windows download (direct `.exe`, no Store): https://www.geteduroam.app/
- Verified cert facts (root CA, `aleph.mendelu.cz`, p12 internals): memory
  `eduroam-cert-installer-facts`.
</content>
</invoke>
