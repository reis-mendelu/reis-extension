# eduroam Drawer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the eduroam drawer's 2×2 device grid + four panel components with a vertical device accordion (Step 1) that expands into a richer numbered tutorial (Step 2), keeping all existing `useEduroamSetup` functionality.

**Architecture:** A typed manual descriptor (`manual.ts`) defines each device's step structure; user-facing copy lives in the i18n locale files. `EduroamDrawer` (shell) holds a nullable `selected` device, wires `useEduroamSetup`, and renders `DeviceAccordion` (Step 1 cards + collapse) which renders `EduroamTutorial` (Step 2). Live controls (Create-QR / Download / Open-settings buttons, real QR image, real password chip) are injected into the tutorial's "action" steps; all other steps show dashed screenshot placeholders.

**Tech Stack:** WXT, React 19, Tailwind 4 + DaisyUI 5, Zustand, Vitest + happy-dom + @testing-library/react, lucide-react icons.

## Global Constraints

- Max 200 lines per file; split if larger.
- NO custom CSS — DaisyUI semantic classes / theme tokens only (`base-100/200/300`, `primary`, `secondary`, `warning`, `success`, `base-content`).
- Direct imports only — no re-export barrels.
- NO `useEffect` for data fetching; NO `localStorage`/`sessionStorage`.
- Test first (TDD): failing test → minimal impl → green → commit.
- All UI strings via `useTranslation()` (`t()` returns strings only; non-string lookups fall back to the key — leaf access into JSON arrays by numeric index IS supported).
- Buttons use standard `btn btn-primary` / `btn btn-secondary` (they inherit the soft/tonal default from `src/index.css`).
- `useEduroamSetup` (`src/hooks/data/useEduroamSetup.ts`) is unchanged. Its API: `{ status, target, selectTarget(t), password, qrDataUrl, error, run(t), reset(), openProfilesSettings() }`; `EduroamTarget = 'mac'|'ios'|'android'|'windows'`; `EduroamStatus = 'idle'|'working'|'done'|'error'`.
- Run after changes: `npm run build` (expect exit 0), `npm run typecheck`, `npm run lint`, `npm run test:run`.

---

### Task 1: i18n keys for the redesigned drawer

**Files:**
- Modify: `src/i18n/locales/cs.json` (the `eduroam` object)
- Modify: `src/i18n/locales/en.json` (the `eduroam` object)
- Test: `src/i18n/__tests__/eduroamWindowsKeys.test.ts` (rewrite to the new key set)

**Interfaces:**
- Produces: i18n keys under `eduroam.*` consumed by Tasks 2–6. Chrome key paths:
  `eduroam.heroTitle`, `eduroam.heroSub`, `eduroam.s1`, `eduroam.s2`, `eduroam.doOnce`,
  `eduroam.pwdLabel`, `eduroam.copy`, `eduroam.copied`, `eduroam.restart`,
  `eduroam.footer`, `eduroam.footerSub`; and per device `D ∈ {ios,android,mac,windows}`:
  `eduroam.manual.D.hint`, `eduroam.manual.D.steps.<i>.text`,
  `eduroam.manual.D.steps.<i>.shot`, optional `eduroam.manual.D.steps.<i>.warn`,
  `eduroam.manual.D.done.text`, `eduroam.manual.D.done.shot`, and (android/windows only)
  `eduroam.manual.D.doOnce.title`, `eduroam.manual.D.doOnce.cta`.
- Reused existing keys (keep): `title`, `subtitle`, `targetIos`, `targetAndroid`, `targetMac`,
  `targetWindows`, `download`, `preparing`, `error`, `regenerate`, `openSettings`,
  `privacyNoteLocal`, `privacyNoteTransfer`.
- Removed keys (delete): `macHostHint`, `iosIntro`, `iosGenerate`, `iosReady`,
  `iosStep1..4`, `androidIntro`, `getEduroam`, `androidGenerate`, `androidReady`,
  `androidStep0..4`, `getEduroamWindows`, `windowsDownloaded`, `windowsStep0..3`,
  `downloaded`, `step1..4`.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/i18n/__tests__/eduroamWindowsKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import cs from '../locales/cs.json';

// Flat (non-manual) keys that must exist as non-empty strings.
const FLAT_KEYS = [
  'heroTitle', 'heroSub', 's1', 's2', 'doOnce', 'pwdLabel', 'copy', 'copied',
  'restart', 'footer', 'footerSub', 'download', 'createQr', 'preparing', 'error', 'regenerate',
  'openSettings', 'privacyNoteLocal', 'privacyNoteTransfer',
  'targetIos', 'targetAndroid', 'targetMac', 'targetWindows',
] as const;

// device -> number of steps in the manual
const DEVICE_STEPS: Record<string, number> = { ios: 4, android: 3, mac: 4, windows: 3 };
const DO_ONCE_DEVICES = ['android', 'windows'] as const;

function leaf(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

describe('eduroam i18n keys', () => {
  for (const [label, dict] of [['en', en], ['cs', cs]] as const) {
    describe(label, () => {
      it.each(FLAT_KEYS)('eduroam.%s is a non-empty string', (key) => {
        const v = leaf(dict, `eduroam.${key}`);
        expect(typeof v).toBe('string');
        expect((v as string).length).toBeGreaterThan(0);
      });

      it.each(Object.entries(DEVICE_STEPS))('manual.%s steps have text + shot', (device, count) => {
        const hint = leaf(dict, `eduroam.manual.${device}.hint`);
        expect(typeof hint).toBe('string');
        for (let i = 0; i < count; i++) {
          expect(typeof leaf(dict, `eduroam.manual.${device}.steps.${i}.text`)).toBe('string');
          expect(typeof leaf(dict, `eduroam.manual.${device}.steps.${i}.shot`)).toBe('string');
        }
        expect(typeof leaf(dict, `eduroam.manual.${device}.done.text`)).toBe('string');
        expect(typeof leaf(dict, `eduroam.manual.${device}.done.shot`)).toBe('string');
      });

      it.each(DO_ONCE_DEVICES)('manual.%s has do-once title + cta', (device) => {
        expect(typeof leaf(dict, `eduroam.manual.${device}.doOnce.title`)).toBe('string');
        expect(typeof leaf(dict, `eduroam.manual.${device}.doOnce.cta`)).toBe('string');
      });
    });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: FAIL (new keys not present yet).

- [ ] **Step 3: Update `cs.json`**

In `src/i18n/locales/cs.json`, replace the whole `"eduroam": { ... }` object with:

```json
  "eduroam": {
    "title": "eduroam Wi-Fi",
    "subtitle": "Nastavte eduroam na svém zařízení na pár kliknutí",
    "heroTitle": "Připoj se k eduroam za pár minut",
    "heroSub": "Vyber zařízení — projdeme tě nastavením krok za krokem.",
    "s1": "Vyber zařízení",
    "s2": "Nastav eduroam",
    "doOnce": "Udělej jednou",
    "pwdLabel": "Tvé heslo certifikátu",
    "copy": "Zkopírovat",
    "copied": "Zkopírováno!",
    "restart": "Vybrat jiné zařízení",
    "footer": "Vytvořeno studenty pro studenty",
    "footerSub": "reIS · studentská iniciativa PEF MENDELU",
    "targetIos": "iPhone / iPad",
    "targetAndroid": "Android",
    "targetMac": "Mac",
    "targetWindows": "Windows",
    "download": "Stáhnout eduroam profil",
    "createQr": "Vytvořit QR kód",
    "preparing": "Připravuji profil…",
    "error": "Profil se nepodařilo připravit",
    "regenerate": "Začít znovu",
    "openSettings": "Otevřít nastavení Profily",
    "privacyNoteLocal": "Vše se generuje ve vašem zařízení a váš soukromý klíč zůstává chráněn heslem, které zadáte jen vy při instalaci.",
    "privacyNoteTransfer": "Vše se generuje ve vašem zařízení a váš soukromý klíč je chráněn heslem, které zadáte jen vy při instalaci. Přenosový odkaz je jednorázový a vyprší během několika minut.",
    "manual": {
      "ios": {
        "hint": "Naskenuj QR kód",
        "steps": [
          { "text": "Klepni na Vytvořit QR kód", "shot": "Vygenerovaný QR kód v panelu reIS" },
          { "text": "Naskenuj ho Fotoaparátem a klepni na odkaz", "shot": "Fotoaparát míří na QR + banner s odkazem" },
          { "text": "Povol stažení, pak Nastavení → „Stažený profil\"", "shot": "Nastavení s řádkem „Stažený profil\" nahoře", "warn": "iOS schová profil v Nastavení a platí jen ~8 minut — pospěš si." },
          { "text": "Klepni na Instalovat a zadej heslo certifikátu", "shot": "Obrazovka Instalovat + pole na heslo" }
        ],
        "done": { "text": "Hotovo — jsi připojen k eduroam", "shot": "Wi-Fi ukazuje připojený eduroam" }
      },
      "android": {
        "hint": "Aplikace geteduroam",
        "doOnce": { "title": "Nainstaluj aplikaci geteduroam", "cta": "Stáhnout z Google Play" },
        "steps": [
          { "text": "Klepni na Vytvořit QR kód", "shot": "Vygenerovaný QR kód v panelu reIS" },
          { "text": "Naskenuj ho, nech stáhnout soubor a otevři ho v geteduroam", "shot": "Stažení → otevření souboru v geteduroam" },
          { "text": "Zadej heslo certifikátu", "shot": "Výzva geteduroam na heslo" }
        ],
        "done": { "text": "Hotovo — jsi připojen k eduroam", "shot": "Telefon připojený k eduroam" }
      },
      "mac": {
        "hint": "Stáhni profil",
        "steps": [
          { "text": "Klikni na Stáhnout eduroam profil", "shot": "Tlačítko Stáhnout eduroam profil" },
          { "text": "Otevři Nastavení → Profily", "shot": "Nastavení systému → Profily" },
          { "text": "Dvojklik na „MENDELU eduroam (reIS)\" → Instalovat", "shot": "Dialog instalace profilu" },
          { "text": "Zadej heslo certifikátu", "shot": "Pole na heslo" }
        ],
        "done": { "text": "Hotovo — jsi připojen k eduroam", "shot": "Mac připojený k eduroam" }
      },
      "windows": {
        "hint": "Aplikace geteduroam",
        "doOnce": { "title": "Nainstaluj geteduroam pro Windows", "cta": "Otevřít geteduroam.app" },
        "steps": [
          { "text": "Klikni na Stáhnout eduroam profil", "shot": "Tlačítko Stáhnout eduroam profil" },
          { "text": "Dvojklik na stažený soubor — otevře se v geteduroam", "shot": "Soubor ve Stažených se otevírá v geteduroam" },
          { "text": "Zadej heslo certifikátu", "shot": "Výzva geteduroam na heslo" }
        ],
        "done": { "text": "Hotovo — jsi připojen k eduroam", "shot": "PC připojené k eduroam" }
      }
    }
  }
```

- [ ] **Step 4: Update `en.json`**

In `src/i18n/locales/en.json`, replace the whole `"eduroam": { ... }` object with:

```json
  "eduroam": {
    "title": "eduroam Wi-Fi",
    "subtitle": "Set up eduroam on your device in a few clicks",
    "heroTitle": "Get on eduroam in a few minutes",
    "heroSub": "Pick your device — we'll walk you through the setup, step by step.",
    "s1": "Pick your device",
    "s2": "Set up eduroam",
    "doOnce": "Do once",
    "pwdLabel": "Your certificate password",
    "copy": "Copy",
    "copied": "Copied!",
    "restart": "Pick another device",
    "footer": "Built by students, for students",
    "footerSub": "reIS · a student initiative at PEF MENDELU",
    "targetIos": "iPhone / iPad",
    "targetAndroid": "Android",
    "targetMac": "Mac",
    "targetWindows": "Windows",
    "download": "Download eduroam profile",
    "createQr": "Create QR code",
    "preparing": "Preparing profile…",
    "error": "Couldn't prepare the profile",
    "regenerate": "Start over",
    "openSettings": "Open Profiles settings",
    "privacyNoteLocal": "Everything is generated on your device and your private key stays protected by a password only you enter at install time.",
    "privacyNoteTransfer": "Everything is generated on your device and your private key is protected by a password only you enter at install time. The transfer link is one-time and expires within a few minutes.",
    "manual": {
      "ios": {
        "hint": "Scan a QR code",
        "steps": [
          { "text": "Tap Create QR code", "shot": "The generated QR code in the reIS drawer" },
          { "text": "Scan it with the Camera and tap the link", "shot": "Camera pointed at the QR + the tap banner" },
          { "text": "Allow the download, then open Settings → \"Profile Downloaded\"", "shot": "Settings with the \"Profile Downloaded\" row near the top", "warn": "iOS hides the profile in Settings and it's valid for ~8 min — be quick." },
          { "text": "Tap Install and enter the certificate password", "shot": "Install screen + the password field" }
        ],
        "done": { "text": "Done — you're on eduroam", "shot": "Wi-Fi showing eduroam connected" }
      },
      "android": {
        "hint": "geteduroam app",
        "doOnce": { "title": "Install the geteduroam app", "cta": "Get it on Google Play" },
        "steps": [
          { "text": "Tap Create QR code", "shot": "The generated QR code in the reIS drawer" },
          { "text": "Scan it, let the file download, open it in geteduroam", "shot": "Download → opening the file in geteduroam" },
          { "text": "Enter the certificate password", "shot": "geteduroam password prompt" }
        ],
        "done": { "text": "Done — you're on eduroam", "shot": "Phone connected to eduroam" }
      },
      "mac": {
        "hint": "Download a profile",
        "steps": [
          { "text": "Click Download eduroam profile", "shot": "The download button" },
          { "text": "Open Profile settings", "shot": "System Settings → Profiles" },
          { "text": "Double-click \"MENDELU eduroam (reIS)\" → Install", "shot": "The profile install dialog" },
          { "text": "Enter the certificate password", "shot": "The password field" }
        ],
        "done": { "text": "Done — you're on eduroam", "shot": "Mac connected to eduroam" }
      },
      "windows": {
        "hint": "geteduroam app",
        "doOnce": { "title": "Install geteduroam for Windows", "cta": "Open geteduroam.app" },
        "steps": [
          { "text": "Click Download eduroam profile", "shot": "The download button" },
          { "text": "Double-click the downloaded file — it opens in geteduroam", "shot": "The file in Downloads opening geteduroam" },
          { "text": "Enter the certificate password", "shot": "geteduroam password prompt" }
        ],
        "done": { "text": "Done — you're on eduroam", "shot": "PC connected to eduroam" }
      }
    }
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: PASS. (Old component tests will fail to compile now — they are fixed in later tasks. Do not run the full suite yet.)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/cs.json src/i18n/locales/en.json src/i18n/__tests__/eduroamWindowsKeys.test.ts
git commit -m "feat(eduroam): i18n keys for drawer redesign (manual subtree)"
```

---

### Task 2: Manual descriptor (`manual.ts`)

**Files:**
- Create: `src/components/Eduroam/manual.ts`
- Test: `src/components/Eduroam/__tests__/manual.test.ts`

**Interfaces:**
- Produces:
  - `type EduroamAction = 'qr' | 'download' | 'openSettings'`
  - `interface StepMeta { action?: EduroamAction; password?: boolean }`
  - `interface DeviceManual { doOnceUrl?: string; steps: StepMeta[] }`
  - `const EDUROAM_MANUAL: Record<EduroamTarget, DeviceManual>`
  - `function manualKey(target: EduroamTarget, ...parts: (string|number)[]): string` → builds `eduroam.manual.<target>.<parts...>` dotted key.
- Consumes: `EduroamTarget` from `src/hooks/data/useEduroamSetup.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/components/Eduroam/__tests__/manual.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EDUROAM_MANUAL, manualKey } from '../manual';
import cs from '../../../i18n/locales/cs.json';
import en from '../../../i18n/locales/en.json';

function leaf(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

describe('EDUROAM_MANUAL', () => {
  const targets = ['ios', 'android', 'mac', 'windows'] as const;

  it('builds dotted manual keys', () => {
    expect(manualKey('ios', 'steps', 0, 'text')).toBe('eduroam.manual.ios.steps.0.text');
    expect(manualKey('mac', 'hint')).toBe('eduroam.manual.mac.hint');
  });

  it('every device has exactly one qr-or-download action step', () => {
    for (const t of targets) {
      const actions = EDUROAM_MANUAL[t].steps.filter((s) => s.action === 'qr' || s.action === 'download');
      expect(actions).toHaveLength(1);
    }
  });

  it('every device has exactly one password step', () => {
    for (const t of targets) {
      expect(EDUROAM_MANUAL[t].steps.filter((s) => s.password)).toHaveLength(1);
    }
  });

  it('only mac has an openSettings step; only android+windows have doOnceUrl', () => {
    expect(EDUROAM_MANUAL.mac.steps.some((s) => s.action === 'openSettings')).toBe(true);
    expect(EDUROAM_MANUAL.ios.steps.some((s) => s.action === 'openSettings')).toBe(false);
    expect(EDUROAM_MANUAL.android.doOnceUrl).toBeTruthy();
    expect(EDUROAM_MANUAL.windows.doOnceUrl).toBeTruthy();
    expect(EDUROAM_MANUAL.ios.doOnceUrl).toBeUndefined();
    expect(EDUROAM_MANUAL.mac.doOnceUrl).toBeUndefined();
  });

  it('every referenced i18n key resolves to a string in both locales', () => {
    for (const t of targets) {
      for (const dict of [cs, en]) {
        expect(typeof leaf(dict, manualKey(t, 'hint'))).toBe('string');
        EDUROAM_MANUAL[t].steps.forEach((_, i) => {
          expect(typeof leaf(dict, manualKey(t, 'steps', i, 'text'))).toBe('string');
          expect(typeof leaf(dict, manualKey(t, 'steps', i, 'shot'))).toBe('string');
        });
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/manual.test.ts`
Expected: FAIL ("Cannot find module '../manual'").

- [ ] **Step 3: Write the implementation**

Create `src/components/Eduroam/manual.ts`:

```ts
import type { EduroamTarget } from '../../hooks/data/useEduroamSetup';

export type EduroamAction = 'qr' | 'download' | 'openSettings';

export interface StepMeta {
  /** Renders a live control in place of the screenshot placeholder. */
  action?: EduroamAction;
  /** Renders the real PasswordChip when a password is available. */
  password?: boolean;
}

export interface DeviceManual {
  /** geteduroam install link for the "do once" block (android/windows only). */
  doOnceUrl?: string;
  steps: StepMeta[];
}

/** Step structure per device. Copy lives in i18n under eduroam.manual.<target>.* */
export const EDUROAM_MANUAL: Record<EduroamTarget, DeviceManual> = {
  ios: {
    steps: [{ action: 'qr' }, {}, {}, { password: true }],
  },
  android: {
    doOnceUrl: 'https://play.google.com/store/apps/details?id=app.eduroam.geteduroam',
    steps: [{ action: 'qr' }, {}, { password: true }],
  },
  mac: {
    steps: [{ action: 'download' }, { action: 'openSettings' }, {}, { password: true }],
  },
  windows: {
    doOnceUrl: 'https://www.geteduroam.app/',
    steps: [{ action: 'download' }, {}, { password: true }],
  },
};

/** Build a dotted i18n key under eduroam.manual.<target>. */
export function manualKey(target: EduroamTarget, ...parts: (string | number)[]): string {
  return ['eduroam', 'manual', target, ...parts].join('.');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Eduroam/__tests__/manual.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Eduroam/manual.ts src/components/Eduroam/__tests__/manual.test.ts
git commit -m "feat(eduroam): typed manual descriptor + key builder"
```

---

### Task 3: Restyle `PasswordChip`

**Files:**
- Modify: `src/components/Eduroam/PasswordChip.tsx`
- Test: `src/components/Eduroam/__tests__/PasswordChip.test.tsx`

**Interfaces:**
- Produces: `PasswordChip({ password, label }: { password: string; label?: string })` — full-width tonal chip; clicking copies the password; shows a check + copied state for 1.5s. Renders `label` above the chip when provided.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

Create `src/components/Eduroam/__tests__/PasswordChip.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PasswordChip } from '../PasswordChip';

afterEach(cleanup);

describe('PasswordChip', () => {
  it('renders the password and an optional label', () => {
    render(<PasswordChip password="9fK2-pQ7m" label="Your password" />);
    expect(screen.getByText('9fK2-pQ7m')).toBeTruthy();
    expect(screen.getByText('Your password')).toBeTruthy();
  });

  it('copies the password to the clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<PasswordChip password="abc123" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abc123'));
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/PasswordChip.test.tsx`
Expected: FAIL (`label` not rendered / prop unsupported).

- [ ] **Step 3: Write the implementation**

Replace `src/components/Eduroam/PasswordChip.tsx`:

```tsx
import { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/** Certificate-password chip with copy-to-clipboard. The student types this at install. */
export function PasswordChip({ password, label }: { password: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the student can still read the password */
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
          {label}
        </span>
      )}
      <button
        onClick={copy}
        className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors"
      >
        <KeyRound className="w-[18px] h-[18px] text-primary shrink-0" />
        <span className="flex-1 text-left font-mono text-[15px] tracking-wide">{password}</span>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary shrink-0">
          {copied ? <Check className="w-[15px] h-[15px]" /> : <Copy className="w-[15px] h-[15px]" />}
          {copied ? t('eduroam.copied') : t('eduroam.copy')}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Eduroam/__tests__/PasswordChip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Eduroam/PasswordChip.tsx src/components/Eduroam/__tests__/PasswordChip.test.tsx
git commit -m "feat(eduroam): tonal PasswordChip with optional label"
```

---

### Task 4: `EduroamTutorial` (Step 2 renderer)

**Files:**
- Create: `src/components/Eduroam/EduroamTutorial.tsx`
- Test: `src/components/Eduroam/__tests__/EduroamTutorial.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface EduroamTutorialProps {
    target: EduroamTarget;
    status: EduroamStatus;
    qrDataUrl: string | null;
    password: string | null;
    onRun: () => void;          // qr/download action steps
    onOpenSettings: () => void; // openSettings action step
  }
  export function EduroamTutorial(props: EduroamTutorialProps): JSX.Element
  ```
- Consumes: `EDUROAM_MANUAL`, `manualKey`, `EduroamAction` (Task 2); `PasswordChip` (Task 3); `useTranslation`; `EduroamTarget`/`EduroamStatus` from the hook module.

- [ ] **Step 1: Write the failing test**

Create `src/components/Eduroam/__tests__/EduroamTutorial.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EduroamTutorial } from '../EduroamTutorial';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => { cleanup(); useAppStore.setState({ language: 'en' }); });

const base = {
  status: 'idle' as const, qrDataUrl: null, password: null,
  onRun: () => {}, onOpenSettings: () => {},
};

describe('EduroamTutorial', () => {
  it('renders the do-once block only for android/windows', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="android" {...base} />);
    expect(screen.getByText('Install the geteduroam app')).toBeTruthy();
    rerender(<EduroamTutorial target="ios" {...base} />);
    expect(screen.queryByText(/geteduroam app$/)).toBeNull();
  });

  it('calls onRun when the action button is clicked', () => {
    useAppStore.setState({ language: 'en' });
    const onRun = vi.fn();
    render(<EduroamTutorial target="ios" {...base} onRun={onRun} />);
    fireEvent.click(screen.getByRole('button', { name: /Create QR code|Download eduroam profile/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('shows the QR image once qrDataUrl is set', () => {
    useAppStore.setState({ language: 'en' });
    render(<EduroamTutorial target="ios" {...base} status="done" qrDataUrl="data:image/png;base64,AAA" />);
    expect(screen.getByAltText(/eduroam QR/i)).toBeTruthy();
  });

  it('renders the password chip only when a password is present', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="mac" {...base} />);
    expect(screen.queryByText('abc-123')).toBeNull();
    rerender(<EduroamTutorial target="mac" {...base} status="done" password="abc-123" />);
    expect(screen.getByText('abc-123')).toBeTruthy();
  });

  it('calls onOpenSettings from the mac open-settings step', () => {
    useAppStore.setState({ language: 'en' });
    const onOpenSettings = vi.fn();
    render(<EduroamTutorial target="mac" {...base} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /Open Profiles settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamTutorial.test.tsx`
Expected: FAIL ("Cannot find module '../EduroamTutorial'").

- [ ] **Step 3: Write the implementation**

Create `src/components/Eduroam/EduroamTutorial.tsx`:

```tsx
import { Loader2, QrCode, Download, ExternalLink, ImageIcon, Check, AlertTriangle, Wifi } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import { EDUROAM_MANUAL, manualKey, type EduroamAction } from './manual';
import type { EduroamTarget, EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface EduroamTutorialProps {
  target: EduroamTarget;
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onRun: () => void;
  onOpenSettings: () => void;
}

/** Dashed 16:9 screenshot placeholder with a caption. */
function Shot({ caption }: { caption: string }) {
  return (
    <div className="relative w-full aspect-video rounded-xl border border-dashed border-base-content/15 bg-base-300/50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-1.5 text-base-content/40 text-center">
        <ImageIcon className="w-5 h-5" />
        <span className="text-xs font-medium leading-snug">{caption}</span>
      </div>
    </div>
  );
}

function ActionButton({ action, status, onRun, onOpenSettings }: {
  action: EduroamAction; status: EduroamStatus; onRun: () => void; onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const working = status === 'working';
  if (action === 'openSettings') {
    return (
      <button className="btn btn-primary btn-sm gap-2" onClick={onOpenSettings}>
        <ExternalLink className="w-4 h-4" /> {t('eduroam.openSettings')}
      </button>
    );
  }
  const Icon = action === 'qr' ? QrCode : Download;
  return (
    <button className="btn btn-primary gap-2" disabled={working} onClick={onRun}>
      {working ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      {working ? t('eduroam.preparing') : action === 'qr' ? t('eduroam.createQr') : t('eduroam.download')}
    </button>
  );
}

export function EduroamTutorial({ target, status, qrDataUrl, password, onRun, onOpenSettings }: EduroamTutorialProps) {
  const { t } = useTranslation();
  const manual = EDUROAM_MANUAL[target];

  return (
    <div className="mt-6">
      {/* Step 2 heading */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-[13px]">2</span>
        <span className="font-semibold text-[15px] text-base-content/80">{t('eduroam.s2')}</span>
      </div>

      {/* Do once */}
      {manual.doOnceUrl && (
        <div className="mb-5 p-4 rounded-2xl border border-dashed border-base-content/15 bg-base-content/[0.025]">
          <div className="inline-flex items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-[11px] font-bold uppercase tracking-wider">
            {t('eduroam.doOnce')}
          </div>
          <div className="text-[15px] mb-3">{t(manualKey(target, 'doOnce', 'title'))}</div>
          <a
            href={manual.doOnceUrl} target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary btn-block gap-2"
          >
            {t(manualKey(target, 'doOnce', 'cta'))} <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Numbered steps */}
      {manual.steps.map((step, i) => {
        const last = i === manual.steps.length - 1;
        const warn = t(manualKey(target, 'steps', i, 'warn'));
        const hasWarn = warn !== manualKey(target, 'steps', i, 'warn');
        const showQr = step.action === 'qr' && status === 'done' && qrDataUrl;
        return (
          <div key={i} className="flex gap-3.5 mb-4">
            <div className="flex flex-col items-center shrink-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-base-100 border border-base-content/10 font-bold text-sm">{i + 1}</span>
              {!last && <div className="w-px flex-1 bg-gradient-to-b from-base-content/15 to-transparent mt-1 min-h-2" />}
            </div>
            <div className="flex-1 pb-1 flex flex-col gap-2.5">
              <div className="text-[15px] leading-relaxed">{t(manualKey(target, 'steps', i, 'text'))}</div>

              {hasWarn && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <span className="text-[13px] leading-snug text-warning">{warn}</span>
                </div>
              )}

              {step.password && password && (
                <PasswordChip password={password} label={t('eduroam.pwdLabel')} />
              )}

              {step.action && !showQr && (
                <ActionButton action={step.action} status={status} onRun={onRun} onOpenSettings={onOpenSettings} />
              )}

              {showQr ? (
                <div className="self-start bg-white p-3 rounded-xl">
                  <img src={qrDataUrl!} alt="eduroam QR" width={200} height={200} />
                </div>
              ) : (
                !step.action && <Shot caption={t(manualKey(target, 'steps', i, 'shot'))} />
              )}
            </div>
          </div>
        );
      })}

      {/* Done banner */}
      <div className="mt-1.5 p-4 rounded-xl bg-primary/10 border border-primary/30">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-content shrink-0"><Check className="w-4 h-4" /></span>
          <span className="font-bold text-[15px]">{t(manualKey(target, 'done', 'text'))}</span>
        </div>
        <div className="relative w-full aspect-video rounded-lg border border-dashed border-primary/30 bg-base-300/50 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-1.5 text-base-content/40 text-center">
            <Wifi className="w-5 h-5" />
            <span className="text-xs font-medium leading-snug">{t(manualKey(target, 'done', 'shot'))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamTutorial.test.tsx src/i18n/__tests__/eduroamWindowsKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Eduroam/EduroamTutorial.tsx src/components/Eduroam/__tests__/EduroamTutorial.test.tsx src/i18n/locales/cs.json src/i18n/locales/en.json src/i18n/__tests__/eduroamWindowsKeys.test.ts
git commit -m "feat(eduroam): Step 2 tutorial renderer (steps, do-once, QR, password)"
```

---

### Task 5: `DeviceAccordion` (Step 1 cards + collapse)

**Files:**
- Create: `src/components/Eduroam/DeviceAccordion.tsx`
- Test: `src/components/Eduroam/__tests__/DeviceAccordion.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface DeviceAccordionProps {
    selected: EduroamTarget | null;
    onSelect: (t: EduroamTarget) => void;
    onRestart: () => void;
    status: EduroamStatus;
    qrDataUrl: string | null;
    password: string | null;
    onRun: () => void;
    onOpenSettings: () => void;
  }
  export function DeviceAccordion(props: DeviceAccordionProps): JSX.Element
  ```
- Consumes: `EduroamTutorial` (Task 4); `useTranslation`; `EduroamTarget`/`EduroamStatus`; lucide icons. Each device card is a `<button>` whose accessible name contains the device label and `aria-expanded` reflects selection.

- [ ] **Step 1: Write the failing test**

Create `src/components/Eduroam/__tests__/DeviceAccordion.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DeviceAccordion } from '../DeviceAccordion';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => { cleanup(); useAppStore.setState({ language: 'en' }); });

const base = {
  status: 'idle' as const, qrDataUrl: null, password: null,
  onSelect: () => {}, onRestart: () => {}, onRun: () => {}, onOpenSettings: () => {},
};

describe('DeviceAccordion', () => {
  it('renders four device cards when nothing is selected', () => {
    useAppStore.setState({ language: 'en' });
    render(<DeviceAccordion selected={null} {...base} />);
    expect(screen.getByRole('button', { name: /iPhone/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Android/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Mac/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Windows/i })).toBeTruthy();
  });

  it('calls onSelect with the device id when a card is clicked', () => {
    useAppStore.setState({ language: 'en' });
    const onSelect = vi.fn();
    render(<DeviceAccordion selected={null} {...base} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Windows/i }));
    expect(onSelect).toHaveBeenCalledWith('windows');
  });

  it('marks the selected card aria-expanded and shows the tutorial', () => {
    useAppStore.setState({ language: 'en' });
    render(<DeviceAccordion selected="ios" {...base} />);
    expect(screen.getByRole('button', { name: /iPhone/i }).getAttribute('aria-expanded')).toBe('true');
    // Step 2 heading from the tutorial
    expect(screen.getByText('Set up eduroam')).toBeTruthy();
  });

  it('calls onRestart from the "pick another device" button', () => {
    useAppStore.setState({ language: 'en' });
    const onRestart = vi.fn();
    render(<DeviceAccordion selected="ios" {...base} onRestart={onRestart} />);
    fireEvent.click(screen.getByRole('button', { name: /Pick another device/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/DeviceAccordion.test.tsx`
Expected: FAIL ("Cannot find module '../DeviceAccordion'").

- [ ] **Step 3: Write the implementation**

Create `src/components/Eduroam/DeviceAccordion.tsx`:

```tsx
import { Smartphone, Tablet, Laptop, Monitor, ChevronRight, Check, RotateCcw, type LucideIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { EduroamTutorial } from './EduroamTutorial';
import type { EduroamTarget, EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface DeviceAccordionProps {
  selected: EduroamTarget | null;
  onSelect: (t: EduroamTarget) => void;
  onRestart: () => void;
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onRun: () => void;
  onOpenSettings: () => void;
}

const DEVICES: { id: EduroamTarget; labelKey: string; icon: LucideIcon }[] = [
  { id: 'ios', labelKey: 'eduroam.targetIos', icon: Smartphone },
  { id: 'android', labelKey: 'eduroam.targetAndroid', icon: Tablet },
  { id: 'mac', labelKey: 'eduroam.targetMac', icon: Laptop },
  { id: 'windows', labelKey: 'eduroam.targetWindows', icon: Monitor },
];

export function DeviceAccordion(props: DeviceAccordionProps) {
  const { selected, onSelect, onRestart, ...live } = props;
  const { t } = useTranslation();

  return (
    <div>
      {/* Step 1 heading */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-[13px]">1</span>
        <span className="font-semibold text-[15px] text-base-content/80">{t('eduroam.s1')}</span>
      </div>

      {DEVICES.map(({ id, labelKey, icon: Icon }) => {
        const isSel = selected === id;
        const collapsed = selected !== null && !isSel;
        return (
          <div
            key={id}
            className={`overflow-hidden rounded-2xl transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0 mb-0 -translate-y-2 pointer-events-none' : 'max-h-32 opacity-100 mb-2.5'} ${isSel ? 'ring-2 ring-primary' : ''}`}
          >
            <button
              aria-expanded={isSel}
              onClick={() => onSelect(id)}
              className="flex items-center gap-3.5 w-full p-4 bg-base-100 border border-base-content/10 rounded-2xl text-left"
            >
              <span className={`flex items-center justify-center w-11 h-11 shrink-0 rounded-xl ${isSel ? 'bg-primary/15 text-primary' : 'bg-base-300 text-base-content/70'}`}>
                <Icon className="w-6 h-6" />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-[17px]">{t(labelKey)}</span>
                <span className="block text-[13px] text-base-content/50 mt-0.5">{t(`eduroam.manual.${id}.hint`)}</span>
              </span>
              <span className={`flex items-center justify-center w-6 h-6 shrink-0 ${isSel ? 'text-primary' : 'text-base-content/40'}`}>
                {isSel ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </span>
            </button>
          </div>
        );
      })}

      {selected && (
        <>
          <EduroamTutorial target={selected} {...live} />
          <button onClick={onRestart} className="btn btn-ghost btn-sm gap-2 mx-auto mt-5 flex">
            <RotateCcw className="w-4 h-4" /> {t('eduroam.restart')}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Eduroam/__tests__/DeviceAccordion.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Eduroam/DeviceAccordion.tsx src/components/Eduroam/__tests__/DeviceAccordion.test.tsx
git commit -m "feat(eduroam): device accordion (Step 1 cards + collapse)"
```

---

### Task 6: Rewrite `EduroamDrawer` (shell) + remove old panels

**Files:**
- Modify (rewrite): `src/components/Eduroam/EduroamDrawer.tsx`
- Modify (rewrite): `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
- Delete: `src/components/Eduroam/IosTransfer.tsx`, `AndroidTransfer.tsx`, `MacInstall.tsx`, `WindowsInstall.tsx`

**Interfaces:**
- Consumes: `DeviceAccordion` (Task 5); `useEduroamSetup`; `useAppStore` (`isEduroamOpen`, `setIsEduroamOpen`); `AdaptiveDrawer`; `useTranslation`.
- Local state: `selected: EduroamTarget | null` (useState, init `null`).
  - `onSelect(t)` → `setSelected(t); selectTarget(t)`.
  - `onRestart()` → `setSelected(null); reset()`.
  - `onRun()` → `run(selected!)`. `onOpenSettings()` → `openProfilesSettings()`.
  - `close()` → `setIsEduroamOpen(false); setSelected(null); reset()`.
- Privacy note key: `selected === 'mac' || selected === 'windows'` → `eduroam.privacyNoteLocal`, else `eduroam.privacyNoteTransfer`.

- [ ] **Step 1: Write the failing test**

Replace `src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EduroamDrawer } from '../EduroamDrawer';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => {
  cleanup();
  useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
});

function open() {
  useAppStore.setState({ isEduroamOpen: true, isTouch: false, isNarrow: false, language: 'en' });
}

describe('EduroamDrawer', () => {
  it('renders nothing when closed', () => {
    useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
    const { container } = render(<EduroamDrawer />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the title and four device cards when open', () => {
    open();
    render(<EduroamDrawer />);
    expect(screen.getByText('eduroam Wi-Fi')).toBeTruthy();
    expect(screen.getByRole('button', { name: /iPhone/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Windows/i })).toBeTruthy();
  });

  it('expands a device tutorial on select and returns via "pick another device"', () => {
    open();
    render(<EduroamDrawer />);
    fireEvent.click(screen.getByRole('button', { name: /Android/i }));
    expect(screen.getByText('Set up eduroam')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pick another device/i }));
    expect(screen.queryByText('Set up eduroam')).toBeNull();
  });

  it('closes via the close button', () => {
    open();
    render(<EduroamDrawer />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
Expected: FAIL (drawer still renders the old grid / `role="tab"`).

- [ ] **Step 3: Write the implementation**

Replace `src/components/Eduroam/EduroamDrawer.tsx`:

```tsx
import { useState } from 'react';
import { Wifi, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useEduroamSetup, type EduroamTarget } from '../../hooks/data/useEduroamSetup';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { DeviceAccordion } from './DeviceAccordion';

/** Side-drawer host for the eduroam setup flow. Self-connects to the store. */
export function EduroamDrawer() {
  const { t } = useTranslation();
  const isOpen = useAppStore((s) => s.isEduroamOpen);
  const setOpen = useAppStore((s) => s.setIsEduroamOpen);
  const { status, password, qrDataUrl, error, run, reset, selectTarget, openProfilesSettings } = useEduroamSetup();
  const [selected, setSelected] = useState<EduroamTarget | null>(null);

  const close = () => { setOpen(false); setSelected(null); reset(); };
  const onSelect = (tg: EduroamTarget) => { setSelected(tg); selectTarget(tg); };
  const onRestart = () => { setSelected(null); reset(); };
  const isLocal = selected === 'mac' || selected === 'windows';

  return (
    <AdaptiveDrawer open={isOpen} onClose={close} width="sm:w-[560px]" title={t('eduroam.title')}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-base-300">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Wifi className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{t('eduroam.title')}</h3>
          <p className="text-xs text-base-content/50 truncate">{t('eduroam.subtitle')}</p>
        </div>
        <button onClick={close} aria-label="Close" className="btn btn-ghost btn-xs btn-circle">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* Hero */}
        <div className="mb-7">
          <h1 className="font-extrabold text-[28px] leading-tight tracking-tight text-balance">{t('eduroam.heroTitle')}</h1>
          <p className="text-[15px] text-base-content/70 mt-2 max-w-[38ch]">{t('eduroam.heroSub')}</p>
        </div>

        {status === 'error' && (
          <div className="alert alert-error text-sm mb-5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('eduroam.error')}{error ? `: ${error}` : ''}</span>
          </div>
        )}

        <DeviceAccordion
          selected={selected}
          onSelect={onSelect}
          onRestart={onRestart}
          status={status}
          qrDataUrl={qrDataUrl}
          password={password}
          onRun={() => selected && run(selected)}
          onOpenSettings={openProfilesSettings}
        />

        {selected && (
          <p className="text-xs text-base-content/40 mt-6">
            {t(isLocal ? 'eduroam.privacyNoteLocal' : 'eduroam.privacyNoteTransfer')}
          </p>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-base-content/[0.07] text-center">
          <div className="font-semibold text-[13px] text-base-content/70">{t('eduroam.footer')}</div>
          <div className="text-xs text-base-content/40 mt-1">{t('eduroam.footerSub')}</div>
        </div>
      </div>
    </AdaptiveDrawer>
  );
}
```

- [ ] **Step 4: Delete the old panel components**

```bash
git rm src/components/Eduroam/IosTransfer.tsx src/components/Eduroam/AndroidTransfer.tsx src/components/Eduroam/MacInstall.tsx src/components/Eduroam/WindowsInstall.tsx
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Eduroam/__tests__/EduroamDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Eduroam/EduroamDrawer.tsx src/components/Eduroam/__tests__/EduroamDrawer.test.tsx
git commit -m "feat(eduroam): rewrite drawer shell as accordion host; remove panels"
```

---

### Task 7: Full verification + cleanup

**Files:** none (verification only); fix any fallout in-place.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If a removed key/component is still referenced anywhere, fix the reference.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean. (Do not modify parsers to satisfy lint; not applicable here.)

- [ ] **Step 3: Full test run**

Run: `npm run test:run`
Expected: all green, including `manual.test.ts`, `EduroamTutorial.test.tsx`, `DeviceAccordion.test.tsx`, `EduroamDrawer.test.tsx`, `PasswordChip.test.tsx`, `eduroamWindowsKeys.test.ts`.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Manual end-to-end (dev build on an IS Mendelu page)**

Run: `npm run dev`, open the drawer, and verify:
- Initial state shows the hero + four device cards (Step 1), no tutorial.
- Selecting a device collapses the other three (animated) and reveals Step 2.
- Android/Windows show the "Do once" geteduroam link; iOS/Mac do not.
- iOS/Android: "Create QR code" → spinner → real QR image renders in step 1.
- Mac/Windows: "Download eduroam profile" downloads the file; Mac shows an "Open Profiles settings" button that opens System Settings.
- The password chip appears only after generation and copies on click.
- "Pick another device" returns to the card list and clears prior output.
- Toggle the app theme (light/dark) — colors adapt; buttons are soft/tonal.
- Switch global language CZ/EN — all copy updates.

- [ ] **Step 6: Commit any verification fixes**

```bash
git add -A
git commit -m "test(eduroam): verification fixes for drawer redesign"
```

---

## Self-Review

**Spec coverage:**
- Accordion + tutorial replacing grid/panels → Tasks 5, 6. ✓
- New units `EduroamDrawer`/`DeviceAccordion`/`EduroamTutorial`/`manual.ts`, `PasswordChip` restyle → Tasks 2–6. ✓
- Manual structure in TS, copy in i18n; arrays-by-index leaf access → Tasks 1, 2. ✓
- `eduroamWindowsKeys.test.ts` updated → Task 1. ✓
- Live QR/download/open-settings/password wired into action steps; placeholders kept elsewhere → Task 4. ✓
- Mac host gating dropped (no `isMac`, no `macHostHint`) → Tasks 1, 6. ✓
- Theme-aware DaisyUI tokens, no custom CSS, soft buttons → all component tasks. ✓
- Global language (no per-drawer toggle), template logo header dropped → Task 6. ✓
- Error + working states preserved → Tasks 4, 6. ✓

**Placeholder scan:** `createQr` key is defined in Task 1 (both JSONs + `FLAT_KEYS`) and consumed by Task 4's `ActionButton`. No TBD/TODO/placeholder code remains.

**Type consistency:** `EduroamTarget`/`EduroamStatus` imported from the hook module everywhere; `EduroamAction`/`StepMeta`/`DeviceManual`/`manualKey`/`EDUROAM_MANUAL` defined in Task 2 and consumed unchanged in Tasks 4–5; `EduroamTutorialProps`/`DeviceAccordionProps` field names match across drawer → accordion → tutorial (`status`, `qrDataUrl`, `password`, `onRun`, `onOpenSettings`, `selected`, `onSelect`, `onRestart`). ✓
