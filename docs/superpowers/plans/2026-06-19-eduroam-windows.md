# Eduroam Windows Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Windows** target to the eduroam tool — generate the existing `.eap-config` and deliver it as a **direct download** that the geteduroam-Windows app installs.

**Architecture:** Windows reuses `generateEapConfig()` unchanged. Because reIS (the Chrome extension) runs *on* the Windows PC, the hook simply `saveAs(...)` the `.eap-config` locally (no QR, no Supabase transfer — exactly the Mac model). A new `WindowsInstall` panel mirrors `MacInstall` (download gated on `isWindows` + cross-host hint) plus Android's geteduroam "step 0" link, and the drawer gains a 4th segment in a 2×2 grid. The shared privacy footer is split per delivery path, fixing a latent Mac copy bug.

**Tech Stack:** React 19, TypeScript (strict), Zustand, Tailwind CSS 4 + DaisyUI 5, Vitest + happy-dom, `@testing-library/react` 16, `file-saver`, WXT.

## Global Constraints

- **DaisyUI semantic classes only** — no custom CSS (Iron Rule).
- **Max 200 lines per file**; **direct imports only**; **no `useEffect` for data fetching** (Iron Rules).
- **Test first** — write a failing test before implementation (Iron Rule).
- **`generateEapConfig()` is REUSED UNCHANGED** — Windows serves the same bytes as Android.
- **The `.p12` passphrase is NEVER embedded.** A direct-download file lingers in Downloads, so this matters more than for Android; `<Passphrase>` stays omitted (geteduroam prompts at import).
- **No new network / Supabase / edge / schema changes.** No QR for Windows.
- **Platform mimicry must be deterministic** — tests stub `navigator.userAgent` or mock the `isWindows` export; they must NOT depend on the OS running the tests (the dev box is macOS).
- After all changes: `npm run typecheck` exit 0, `npm run test:run` all pass, `npm run build` exit 0 (confirm exit 0 before claiming done — standing user rule).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/i18n/locales/en.json` | English copy: Windows keys + split privacy note | Modify |
| `src/i18n/locales/cs.json` | Czech copy: same keys | Modify |
| `src/i18n/__tests__/eduroamWindowsKeys.test.ts` | Asserts both locales carry the new keys (parity) | Create |
| `src/hooks/data/useEduroamSetup.ts` | `isWindows`, `'windows'` target, `run('windows')` saveAs branch, default target | Modify |
| `src/hooks/data/__tests__/useEduroamSetup.test.ts` | Add `run('windows')` → `saveAs` `.eap-config` test | Modify |
| `src/hooks/data/__tests__/useEduroamSetup.platform.test.ts` | Windows UA → `isWindows` true + default target `'windows'` | Create |
| `src/components/Eduroam/WindowsInstall.tsx` | Windows panel (gate + geteduroam step 0 + stepper) | Create |
| `src/components/Eduroam/__tests__/WindowsInstall.onWindows.test.tsx` | `isWindows=true` → download enabled, link, stepper | Create |
| `src/components/Eduroam/__tests__/WindowsInstall.offHost.test.tsx` | `isWindows=false` → download disabled + hint | Create |
| `src/components/Eduroam/EduroamDrawer.tsx` | 4th segment, 2×2 grid, render `WindowsInstall`, per-path note | Modify |
| `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx` | Assert the Windows segment | Modify |
| `docs/superpowers/specs/2026-06-19-eduroam-windows-verification-checklist.md` | On-real-Windows DoD checklist | Create |

---

## Task 1: i18n — Windows keys + privacy-note split

Adds every Windows string and the two split privacy-note keys to **both** locales. The old `eduroam.privacyNote` is kept for now (the drawer still uses it until Task 4) and removed in Task 4.

**Files:**
- Create: `src/i18n/__tests__/eduroamWindowsKeys.test.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/cs.json`

**Interfaces:**
- Produces: `eduroam.targetWindows`, `eduroam.windowsHostHint`, `eduroam.getEduroamWindows`, `eduroam.windowsDownloaded`, `eduroam.windowsStep0`, `eduroam.windowsStep1`, `eduroam.windowsStep2`, `eduroam.windowsStep3`, `eduroam.privacyNoteLocal`, `eduroam.privacyNoteTransfer` in both `en.json` and `cs.json`.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/__tests__/eduroamWindowsKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import cs from '../locales/cs.json';

const NEW_KEYS = [
  'targetWindows',
  'windowsHostHint',
  'getEduroamWindows',
  'windowsDownloaded',
  'windowsStep0',
  'windowsStep1',
  'windowsStep2',
  'windowsStep3',
  'privacyNoteLocal',
  'privacyNoteTransfer',
] as const;

describe('eduroam Windows i18n keys', () => {
  it.each(NEW_KEYS)('en.eduroam.%s is a non-empty string', (key) => {
    const v = (en.eduroam as Record<string, string>)[key];
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it.each(NEW_KEYS)('cs.eduroam.%s is a non-empty string', (key) => {
    const v = (cs.eduroam as Record<string, string>)[key];
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: FAIL — keys are `undefined` (not strings).

- [ ] **Step 3: Add the English keys**

In `src/i18n/locales/en.json`, inside the `"eduroam"` object, add these keys (next to the existing `targetAndroid` / `regenerate` keys) and add `privacyNoteTransfer` as a copy of the existing `privacyNote`; keep `privacyNote` for now:

```json
      "targetWindows": "Windows",
      "windowsHostHint": "You're not on Windows — switch to your Windows PC to download here, or use another tab.",
      "getEduroamWindows": "Install the geteduroam app (geteduroam.app)",
      "windowsDownloaded": "Profile downloaded.",
      "windowsStep0": "Install the geteduroam app for Windows first (link above).",
      "windowsStep1": "Double-click the downloaded eduroam-reis.eap-config file to open it in geteduroam.",
      "windowsStep2": "When geteduroam asks for the certificate password, enter:",
      "windowsStep3": "geteduroam installs the profile and your PC joins eduroam.",
      "privacyNoteLocal": "Everything is generated on your device and your private key stays protected by a password only you enter on install.",
      "privacyNoteTransfer": "Everything is generated on your device and your private key stays protected by a password only you enter on install. The transfer link is one-time and expires within minutes."
```

- [ ] **Step 4: Add the Czech keys**

In `src/i18n/locales/cs.json`, inside the `"eduroam"` object, add:

```json
      "targetWindows": "Windows",
      "windowsHostHint": "Nejste na Windows — pro stažení přepněte na svůj počítač s Windows, nebo použijte jinou záložku.",
      "getEduroamWindows": "Nainstalujte aplikaci geteduroam (geteduroam.app)",
      "windowsDownloaded": "Profil stažen.",
      "windowsStep0": "Nejprve nainstalujte aplikaci geteduroam pro Windows (odkaz výše).",
      "windowsStep1": "Dvojklikem na stažený soubor eduroam-reis.eap-config ho otevřete v aplikaci geteduroam.",
      "windowsStep2": "Až se geteduroam zeptá na heslo certifikátu, zadejte:",
      "windowsStep3": "geteduroam nainstaluje profil a počítač se připojí k eduroam.",
      "privacyNoteLocal": "Vše se generuje ve vašem zařízení a váš soukromý klíč zůstává chráněn heslem, které zadáte jen vy při instalaci.",
      "privacyNoteTransfer": "Vše se generuje ve vašem zařízení a váš soukromý klíč je chráněn heslem, které zadáte jen vy při instalaci. Přenosový odkaz je jednorázový a vyprší během několika minut."
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: PASS (20 cases).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/cs.json src/i18n/__tests__/eduroamWindowsKeys.test.ts
git commit -m "feat(eduroam): i18n keys for Windows panel + split privacy note"
```

---

## Task 2: Hook — `isWindows`, `'windows'` target, direct-download branch

Adds Windows to `useEduroamSetup`. `generateEapConfig` and `saveAs` are **already imported** by the hook, so no new imports are needed.

**Files:**
- Modify: `src/hooks/data/useEduroamSetup.ts`
- Modify: `src/hooks/data/__tests__/useEduroamSetup.test.ts`
- Create: `src/hooks/data/__tests__/useEduroamSetup.platform.test.ts`

**Interfaces:**
- Consumes: `generateEapConfig` (existing), `saveAs` from `file-saver` (existing), `fetchEduroamCertMaterial` (existing).
- Produces:
  - `export const isWindows: boolean`
  - `EduroamTarget = 'mac' | 'ios' | 'android' | 'windows'`
  - `run('windows')` → `saveAs(new Blob([eap], { type: 'application/eap-config' }), 'eduroam-reis.eap-config')`, then `status='done'`, `password` set.
  - Default `target` = `isWindows ? 'windows' : isMac ? 'mac' : 'ios'`.

- [ ] **Step 1: Write the failing `run('windows')` test**

In `src/hooks/data/__tests__/useEduroamSetup.test.ts`, add two hoisted mocks (after the existing `vi.mock('../../../api/eduroamTransfer', ...)` block) and a new test. Add the mocks:

```ts
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('../../../services/eduroam/eapConfig', () => ({
  generateEapConfig: vi.fn().mockReturnValue('<eap-config/>'),
}));
```

Add the import at the top (with the other imports):

```ts
import { saveAs } from 'file-saver';
```

Add the test inside the `describe('useEduroamSetup', ...)` block:

```ts
  it("run('windows') saves a .eap-config file directly (no QR, no transfer)", async () => {
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('windows');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.password).toBe('pw123');
    expect(result.current.qrDataUrl).toBeNull();
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'eduroam-reis.eap-config');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/data/__tests__/useEduroamSetup.test.ts`
Expected: FAIL — `run('windows')` currently falls into the `else` (Mac) branch and calls `saveAs(..., 'eduroam-reis.mobileconfig')`, so the `'eduroam-reis.eap-config'` assertion fails (and a TS error: `'windows'` is not assignable to `EduroamTarget`).

- [ ] **Step 3: Add `isWindows` and the `'windows'` target type**

In `src/hooks/data/useEduroamSetup.ts`, change the `EduroamTarget` type (line ~12):

```ts
export type EduroamTarget = 'mac' | 'ios' | 'android' | 'windows';
```

Add the detection const right after the existing `isMac` line (line ~14):

```ts
export const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);
```

Change the default-target `useState` (line ~21) from:

```ts
  const [target, setTarget] = useState<EduroamTarget>(isMac ? 'mac' : 'ios');
```

to:

```ts
  const [target, setTarget] = useState<EduroamTarget>(
    isWindows ? 'windows' : isMac ? 'mac' : 'ios',
  );
```

- [ ] **Step 4: Add the `run('windows')` branch**

In `run`, the current shape is `if (t === 'ios') {…} else if (t === 'android') {…} else {…/* mac saveAs */}`. Insert a `windows` branch **before** the final `else`. Replace:

```ts
      } else {
        saveAs(new Blob([xml], { type: 'application/x-apple-aspen-config' }), 'eduroam-reis.mobileconfig');
      }
```

with:

```ts
      } else if (t === 'windows') {
        // Windows: same .eap-config as Android, but reIS runs on this PC, so we
        // save it straight to disk. geteduroam (Windows) opens it on double-click.
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        saveAs(new Blob([eap], { type: 'application/eap-config' }), 'eduroam-reis.eap-config');
      } else {
        saveAs(new Blob([xml], { type: 'application/x-apple-aspen-config' }), 'eduroam-reis.mobileconfig');
      }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/hooks/data/__tests__/useEduroamSetup.test.ts`
Expected: PASS (existing `reset()` test + the new `run('windows')` test).

- [ ] **Step 6: Write the platform-detection test (deterministic Windows mimic)**

Create `src/hooks/data/__tests__/useEduroamSetup.platform.test.ts`. This stubs `navigator.userAgent` and re-imports the module so detection is exercised **regardless of the host OS** running the tests:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';

async function importAs(ua: string) {
  vi.resetModules();
  vi.stubGlobal('navigator', { userAgent: ua });
  return import('../useEduroamSetup');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('useEduroamSetup platform detection', () => {
  it('detects Windows and defaults the target to windows', async () => {
    const mod = await importAs(WINDOWS_UA);
    expect(mod.isWindows).toBe(true);
    const { result } = renderHook(() => mod.useEduroamSetup());
    expect(result.current.target).toBe('windows');
  });

  it('on macOS, isWindows is false and the target is not windows', async () => {
    const mod = await importAs(MAC_UA);
    expect(mod.isWindows).toBe(false);
    const { result } = renderHook(() => mod.useEduroamSetup());
    expect(result.current.target).not.toBe('windows');
  });
});
```

- [ ] **Step 7: Run the platform test**

Run: `npx vitest run src/hooks/data/__tests__/useEduroamSetup.platform.test.ts`
Expected: PASS (both cases). Note: this file uses dynamic `import()` with `resetModules`, so it does not need the API mocks from the sibling test file (the assertions never call `run`).

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/data/useEduroamSetup.ts src/hooks/data/__tests__/useEduroamSetup.test.ts src/hooks/data/__tests__/useEduroamSetup.platform.test.ts
git commit -m "feat(eduroam): Windows target — isWindows + direct .eap-config download"
```

---

## Task 3: `WindowsInstall` panel

A new device panel mirroring `MacInstall` (download gated on `isWindows`, cross-host hint) plus Android's geteduroam "step 0" link. The geteduroam **download** URL is a local module constant (like `AndroidTransfer`'s `GETEDUROAM_PLAY_URL`); the `guideHref` prop keeps `MacInstall`'s meaning (the MENDELU guide, used only in the off-host hint).

**Files:**
- Create: `src/components/Eduroam/WindowsInstall.tsx`
- Create: `src/components/Eduroam/__tests__/WindowsInstall.onWindows.test.tsx`
- Create: `src/components/Eduroam/__tests__/WindowsInstall.offHost.test.tsx`

**Interfaces:**
- Consumes: `isWindows`, `EduroamStatus` (Task 2); `PasswordChip`; `useTranslation`.
- Produces: `export function WindowsInstall(props: { status: EduroamStatus; password: string | null; guideHref: string; onDownload: () => void })`.

- [ ] **Step 1: Write the on-Windows test (reliable Windows mimic via mocked `isWindows`)**

Create `src/components/Eduroam/__tests__/WindowsInstall.onWindows.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../hooks/data/useEduroamSetup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/data/useEduroamSetup')>()),
  isWindows: true,
}));

import { WindowsInstall } from '../WindowsInstall';

afterEach(() => cleanup());

function en() {
  useAppStore.setState({ language: 'en' });
}

describe('WindowsInstall on a Windows machine', () => {
  it('shows the geteduroam link and an enabled download button', () => {
    en();
    render(<WindowsInstall status="idle" password={null} guideHref="https://eduroam.mendelu.cz/" onDownload={() => {}} />);
    expect(screen.getByText(/geteduroam/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Download eduroam profile/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows the stepper with the .eap-config filename and the password chip when done', () => {
    en();
    render(<WindowsInstall status="done" password="pw123" guideHref="https://eduroam.mendelu.cz/" onDownload={() => {}} />);
    expect(screen.getByText(/eduroam-reis\.eap-config/i)).toBeTruthy();
    expect(screen.getByText('pw123')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Write the off-host test (reliable non-Windows mimic)**

Create `src/components/Eduroam/__tests__/WindowsInstall.offHost.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../hooks/data/useEduroamSetup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/data/useEduroamSetup')>()),
  isWindows: false,
}));

import { WindowsInstall } from '../WindowsInstall';

afterEach(() => cleanup());

describe('WindowsInstall off a Windows machine', () => {
  it('disables the download button and shows the cross-host hint', () => {
    useAppStore.setState({ language: 'en' });
    render(<WindowsInstall status="idle" password={null} guideHref="https://eduroam.mendelu.cz/" onDownload={() => {}} />);
    const btn = screen.getByRole('button', { name: /Download eduroam profile/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/not on Windows/i)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run src/components/Eduroam/__tests__/WindowsInstall.onWindows.test.tsx src/components/Eduroam/__tests__/WindowsInstall.offHost.test.tsx`
Expected: FAIL — `Cannot find module '../WindowsInstall'`.

- [ ] **Step 4: Create the component**

Create `src/components/Eduroam/WindowsInstall.tsx`:

```tsx
import { Download, ShieldCheck, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import { isWindows, type EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  password: string | null;
  guideHref: string; // MENDELU guide — used only in the !isWindows hint (same as MacInstall)
  onDownload: () => void;
}

const GETEDUROAM_WINDOWS_URL = 'https://www.geteduroam.app/';

/** Windows path: download the .eap-config on this PC and open it in geteduroam. */
export function WindowsInstall({ status, password, guideHref, onDownload }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <a
        className="link link-primary text-sm inline-flex items-center gap-1"
        href={GETEDUROAM_WINDOWS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink className="w-4 h-4" /> {t('eduroam.getEduroamWindows')}
      </a>

      {!isWindows && (
        <div className="alert alert-info text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {t('eduroam.windowsHostHint')}{' '}
            <a className="link" href={guideHref} target="_blank" rel="noopener noreferrer">
              {t('eduroam.openGuide')}
            </a>
          </span>
        </div>
      )}

      {status !== 'done' && (
        <button
          className="btn btn-primary btn-lg gap-2"
          disabled={!isWindows || status === 'working'}
          onClick={onDownload}
        >
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.download')}
        </button>
      )}

      {status === 'done' && (
        <div className="flex flex-col gap-4">
          <div className="alert alert-success text-sm">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t('eduroam.windowsDownloaded')}</span>
          </div>
          <ul className="steps steps-vertical">
            <li className="step step-primary text-sm text-left">{t('eduroam.windowsStep0')}</li>
            <li className="step step-primary text-sm text-left">{t('eduroam.windowsStep1')}</li>
            <li className="step step-primary text-sm text-left">
              <span>
                {t('eduroam.windowsStep2')}
                {password && <PasswordChip password={password} />}
              </span>
            </li>
            <li className="step step-primary text-sm text-left">{t('eduroam.windowsStep3')}</li>
          </ul>
          <button className="btn btn-ghost btn-sm self-start" onClick={onDownload}>
            {t('eduroam.regenerate')}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run both tests to verify they pass**

Run: `npx vitest run src/components/Eduroam/__tests__/WindowsInstall.onWindows.test.tsx src/components/Eduroam/__tests__/WindowsInstall.offHost.test.tsx`
Expected: PASS (3 cases). `windowsStep1` contains the literal `eduroam-reis.eap-config`, satisfying the filename assertion.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/Eduroam/WindowsInstall.tsx src/components/Eduroam/__tests__/WindowsInstall.onWindows.test.tsx src/components/Eduroam/__tests__/WindowsInstall.offHost.test.tsx
git commit -m "feat(eduroam): WindowsInstall panel (geteduroam + direct .eap-config download)"
```

---

## Task 4: Wire the drawer — 4th segment, 2×2 grid, per-path note

Adds Windows to the picker, switches it to a 2×2 grid, renders `WindowsInstall`, and splits the privacy note by delivery path (removing the now-wrong shared note). After this task the feature is fully reachable.

**Files:**
- Modify: `src/components/Eduroam/EduroamDrawer.tsx`
- Modify: `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json` (remove the old `privacyNote`)

**Interfaces:**
- Consumes: `WindowsInstall` (Task 3); `eduroam.privacyNoteLocal` / `eduroam.privacyNoteTransfer` (Task 1); `run('windows')`, `'windows'` target (Task 2).
- Produces: a 4-segment picker (`role="tab"` each) including one named "Windows"; per-path footer note.

- [ ] **Step 1: Update the drawer test (Windows segment)**

In `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`, replace the `'renders the title and three device segments when open'` test with a four-segment version and add a Windows switch assertion:

```tsx
  it('renders the title and four device segments when open', () => {
    open();
    render(<EduroamDrawer />);
    expect(screen.getByText('eduroam Wi-Fi')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /iPhone/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Android/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Mac/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Windows/i })).toBeTruthy();
  });

  it('switches to the Windows segment on click', () => {
    open();
    render(<EduroamDrawer />);
    const windows = screen.getByRole('tab', { name: /Windows/i });
    fireEvent.click(windows);
    expect(windows.getAttribute('aria-selected')).toBe('true');
  });
```

- [ ] **Step 2: Run the drawer test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
Expected: FAIL — no `role="tab"` named "Windows" yet.

- [ ] **Step 3: Add the Windows segment + 2×2 grid**

In `src/components/Eduroam/EduroamDrawer.tsx`:

Change the lucide import (line 1) to include `Monitor`:

```tsx
import { Wifi, Smartphone, Laptop, Tablet, Monitor, AlertTriangle, X } from 'lucide-react';
```

Add the `WindowsInstall` import after the `MacInstall` import (line 8):

```tsx
import { WindowsInstall } from './WindowsInstall';
```

Extend `SEGMENTS` (lines 10–14) with the Windows entry:

```tsx
const SEGMENTS: { id: EduroamTarget; labelKey: string; icon: typeof Smartphone }[] = [
  { id: 'ios', labelKey: 'eduroam.targetIos', icon: Smartphone },
  { id: 'android', labelKey: 'eduroam.targetAndroid', icon: Tablet },
  { id: 'mac', labelKey: 'eduroam.targetMac', icon: Laptop },
  { id: 'windows', labelKey: 'eduroam.targetWindows', icon: Monitor },
];
```

Replace the picker container + buttons (lines 49–61) — drop `join`/`join-item` for a 2×2 grid:

```tsx
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

- [ ] **Step 4: Render the Windows panel**

Add the Windows branch right after the `target === 'mac'` block (after line 87):

```tsx
        {target === 'windows' && (
          <WindowsInstall
            status={status}
            password={password}
            guideHref={guideHref}
            onDownload={() => run('windows')}
          />
        )}
```

- [ ] **Step 5: Make the privacy note per-path**

Replace the footer note (line 89):

```tsx
        <p className="text-xs text-base-content/40">{t('eduroam.privacyNote')}</p>
```

with:

```tsx
        <p className="text-xs text-base-content/40">
          {t(target === 'mac' || target === 'windows' ? 'eduroam.privacyNoteLocal' : 'eduroam.privacyNoteTransfer')}
        </p>
```

- [ ] **Step 6: Remove the now-unused `privacyNote` key**

Confirm nothing else references it:

Run: `grep -rn "eduroam.privacyNote\b\|'eduroam.privacyNote'\|\"privacyNote\"" src --include="*.ts" --include="*.tsx"`
Expected: only the two locale files now match `"privacyNote"` (the drawer no longer references it). Delete the `"privacyNote": "..."` line from **both** `src/i18n/locales/en.json` and `src/i18n/locales/cs.json`.

- [ ] **Step 7: Run the drawer test to verify it passes**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
Expected: PASS (open/close, 4 segments, Android switch, Windows switch).

- [ ] **Step 8: Run the whole eduroam suite + typecheck**

Run: `npx vitest run src/components/Eduroam src/hooks/data/__tests__/useEduroamSetup.test.ts src/hooks/data/__tests__/useEduroamSetup.platform.test.ts src/i18n/__tests__/eduroamWindowsKeys.test.ts && npm run typecheck`
Expected: all PASS, typecheck exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/Eduroam/EduroamDrawer.tsx src/components/Eduroam/__tests__/EduroamDrawer.test.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(eduroam): drawer Windows segment (2x2 grid) + per-path privacy note"
```

---

## Task 5: Verification checklist doc + final verification

Captures the on-real-Windows DoD (the one thing no tool can mimic) and runs the full gates.

**Files:**
- Create: `docs/superpowers/specs/2026-06-19-eduroam-windows-verification-checklist.md`

- [ ] **Step 1: Write the checklist doc**

Create `docs/superpowers/specs/2026-06-19-eduroam-windows-verification-checklist.md`:

```markdown
# eduroam Windows — on-device verification checklist

**DoD:** the developer connects to eduroam on a real Windows PC through this pipeline
and explicitly confirms it ("verified on my Windows"). Unit tests mimic the Windows
*browser* (UA detection) deterministically, but the geteduroam install + RADIUS join
can only be proven on real Windows.

1. [ ] Build the extension (`npm run build`) and load it on a Windows PC; open eduroam → the **Windows** segment is selected by default.
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
```

- [ ] **Step 2: Full unit suite**

Run: `npm run test:run`
Expected: all PASS (new Windows tests + existing suite).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-19-eduroam-windows-verification-checklist.md
git commit -m "docs(eduroam): on-Windows verification checklist"
```

---

## Final Verification

- [ ] `npm run typecheck` → exit 0
- [ ] `npm run test:run` → all pass (incl. `useEduroamSetup.platform`, `WindowsInstall.*`, `eduroamWindowsKeys`, `EduroamDrawer`)
- [ ] `npm run build` → exit 0
- [ ] `grep -rn "privacyNote\"" src/i18n/locales` → no matches (old key removed; only `privacyNoteLocal` / `privacyNoteTransfer` remain)
- [ ] Manual smoke (`npm run dev`): open the eduroam drawer → 4 segments in a 2×2 grid; the Windows segment shows the geteduroam link + (off-Windows) a disabled download + hint; on a Windows UA the download is enabled.
- [ ] On-real-Windows DoD (Task 5 doc) completed and confirmed in the PR.

---

## Self-Review

**Spec coverage:**
- Reuse `generateEapConfig` unchanged → Task 2 (imported, never edited).
- Direct `saveAs` `.eap-config`, no QR/transfer → Task 2 Step 4 (`run('windows')`).
- `isWindows` + default target → Task 2 Steps 3, 6–7.
- `WindowsInstall` mirrors Mac gate + Android step-0 link → Task 3.
- geteduroam download = local constant; `guideHref` = MENDELU guide → Task 3 Step 4.
- 4th segment + 2×2 grid + `Monitor` icon → Task 4 Steps 3.
- Render Windows panel → Task 4 Step 4.
- Per-path privacy note + fix Mac bug + remove old key → Task 4 Steps 5–6, Task 1.
- No-embedded-passphrase posture → inherited from the reused generator; verified in Task 5 step 7.
- Deterministic Windows mimic → Task 2 platform test (UA stub + dynamic import), Task 3 (`isWindows` mock).
- On-real-Windows DoD → Task 5.
- Tests green + build 0 → Task 4 Step 8, Final Verification.

**Placeholder scan:** none — every step shows full file or exact edit and a runnable command.

**Type consistency:** `EduroamTarget` (Task 2) includes `'windows'`, consumed by the drawer (Task 4) and the `run('windows')` calls. `WindowsInstall` props (`status`, `password`, `guideHref`, `onDownload`) defined in Task 3 match the drawer's usage in Task 4. `isWindows`/`EduroamStatus` imported from the hook in both the component and its tests. i18n keys created in Task 1 are exactly the keys referenced in Tasks 3–4.

**Scope note:** Windows is a desktop-where-reIS-runs platform; like Mac it has no mobile entry-point concern. No Supabase/edge/schema touched. The picker grid change is shared UI but behavior-preserving for the other three segments (still `role="tab"` + `aria-selected`).
</content>
