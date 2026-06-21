# eduroam Android (geteduroam + `.eap-config`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Android target to the reIS eduroam tool: generate an eduroam CAT `.eap-config`, deliver it desktop→phone over the existing QR/Supabase transfer, and let the geteduroam app install it.

**Architecture:** A new pure generator (`eapConfig.ts`) emits the `.eap-config` XML (sibling to the existing `mobileconfig.ts`, reusing `base64.ts`). The already-shipped one-time Supabase transfer is reused unchanged except the receiver edge function now picks the response MIME from a `?fmt=` query param. The desktop UI gains a third "Android" tab whose panel mirrors the iOS one (QR + steps + password chip + geteduroam store link).

**Tech Stack:** TypeScript (strict), Vitest (`globals: true`, happy-dom), React 19 + DaisyUI, Deno (Supabase edge function). No new npm dependencies (`qrcode`, `@supabase/supabase-js`, `file-saver`, `lucide-react` already present).

**Spec:** `docs/superpowers/specs/2026-06-17-eduroam-android-design.md`

**Branch:** `feat/eduroam-mobileconfig` (current; continue on it).

## Global Constraints

- **Passphrase is NEVER embedded** in the `.eap-config` (`<Passphrase>` omitted) — geteduroam prompts the student. Load-bearing security property.
- **Server validation never skippable:** `<ServerID>aleph.mendelu.cz</ServerID>` + embedded MENDELU root CA; no trust-any escape hatch.
- **EAP-TLS = `<Type>13</Type>`**; SSID `eduroam`; root CA encoding `X.509`/`base64`; client cert `PKCS12`/`base64`.
- **iOS and macOS paths must stay byte-for-byte unchanged** (the `?fmt=` default is `ios`; the existing iOS QR URL must not change).
- **Max 200 lines per file. Direct imports only — no barrels. Test-first (TDD).**
- After every change run `npm run build` and confirm exit 0 before re-testing (project rule).
- Run a single test file with `npx vitest run <path>`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/services/eduroam/eapConfig.ts` | `generateEapConfig(input)` → `.eap-config` XML | Create |
| `src/services/eduroam/eapConfig.test.ts` | generator behavior | Create |
| `src/api/eduroamTransfer.ts` | `buildTransferUrl(id, fmt)` gains format arg | Modify |
| `src/api/eduroamTransfer.test.ts` | URL format test | Modify (or create if absent) |
| `supabase/functions/eduroam-receive/index.ts` | pick MIME/filename from `?fmt=` | Modify |
| `src/hooks/data/useEduroamSetup.ts` | `'android'` target + `run('android')` | Modify |
| `src/components/Eduroam/AndroidTransfer.tsx` | Android QR panel | Create |
| `src/components/Eduroam/EduroamSetup.tsx` | third "Android" tab | Modify |
| `src/i18n/locales/cs.json`, `en.json` | Android strings + privacyNote fix | Modify |

---

## Task 1: `.eap-config` generator

**Files:**
- Create: `src/services/eduroam/eapConfig.ts`
- Test: `src/services/eduroam/eapConfig.test.ts`

**Interfaces:**
- Consumes: `bytesToBase64(bytes: Uint8Array): string` from `./base64`.
- Produces: `generateEapConfig(input: EapConfigInput): string` and `interface EapConfigInput { rootCaDer: Uint8Array; clientP12: Uint8Array; serverNames?: string[]; identifier?: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/eduroam/eapConfig.test.ts
import { describe, it, expect } from 'vitest';
import { generateEapConfig } from './eapConfig';

const root = new Uint8Array([0x4d, 0x61, 0x6e]); // "Man" -> "TWFu"
const p12 = new Uint8Array([1, 2, 3]);

describe('generateEapConfig', () => {
  it('throws on empty rootCaDer', () => {
    expect(() => generateEapConfig({ rootCaDer: new Uint8Array(), clientP12: p12 })).toThrow(/rootCaDer/);
  });

  it('throws on empty clientP12', () => {
    expect(() => generateEapConfig({ rootCaDer: root, clientP12: new Uint8Array() })).toThrow(/clientP12/);
  });

  it('throws on empty serverNames', () => {
    expect(() => generateEapConfig({ rootCaDer: root, clientP12: p12, serverNames: [] })).toThrow(/serverNames/);
  });

  it('emits an EAPIdentityProviderList root with EAP-TLS type 13', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<EAPIdentityProviderList');
    expect(xml).toContain('<EAPMethod>');
    expect(xml).toContain('<Type>13</Type>');
  });

  it('embeds the root CA as X.509 base64 and the client cert as PKCS12 base64', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<CA format="X.509" encoding="base64">TWFu</CA>');
    expect(xml).toContain('<ClientCertificate format="PKCS12" encoding="base64">AQID</ClientCertificate>');
  });

  it('defaults the server id to aleph.mendelu.cz', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<ServerID>aleph.mendelu.cz</ServerID>');
  });

  it('targets the eduroam SSID', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<SSID>eduroam</SSID>');
  });

  it('NEVER embeds a passphrase (geteduroam prompts)', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).not.toContain('<Passphrase>');
  });

  it('XML-escapes special characters in server names', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12, serverNames: ['a&b<c'] });
    expect(xml).toContain('<ServerID>a&amp;b&lt;c</ServerID>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/eduroam/eapConfig.test.ts`
Expected: FAIL — cannot find module `./eapConfig`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/eduroam/eapConfig.ts
import { bytesToBase64 } from './base64';

const DEFAULT_SERVER_NAMES = ['aleph.mendelu.cz'];
const DEFAULT_IDENTIFIER = 'cz.reis.eduroam';

export interface EapConfigInput {
  /** MENDELU root CA, DER bytes (server-validation anchor). */
  rootCaDer: Uint8Array;
  /** Student's PKCS#12 (cert + private key) bytes. */
  clientP12: Uint8Array;
  /** RADIUS server names to validate. Default ["aleph.mendelu.cz"]. */
  serverNames?: string[];
  /** EAPIdentityProvider ID. Default "cz.reis.eduroam". */
  identifier?: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build an eduroam CAT `.eap-config` (EAP metadata XML) that geteduroam consumes:
 * MENDELU root CA + the student's PKCS#12 client identity + an EAP-TLS profile for
 * the `eduroam` SSID. The .p12 passphrase is intentionally NEVER embedded —
 * geteduroam prompts the student at import, so an intercepted file is an
 * unopenable PKCS#12.
 */
export function generateEapConfig(input: EapConfigInput): string {
  const { rootCaDer, clientP12 } = input;
  if (!rootCaDer || rootCaDer.length === 0) throw new Error('rootCaDer is empty');
  if (!clientP12 || clientP12.length === 0) throw new Error('clientP12 is empty');

  const serverNames = input.serverNames ?? DEFAULT_SERVER_NAMES;
  if (serverNames.length === 0) throw new Error('serverNames is empty');
  const identifier = input.identifier ?? DEFAULT_IDENTIFIER;

  const serverIds = serverNames.map((n) => `        <ServerID>${escapeXml(n)}</ServerID>`).join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<EAPIdentityProviderList xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="eap-metadata.xsd">',
    `  <EAPIdentityProvider ID="${escapeXml(identifier)}" namespace="urn:RFC4282:realm">`,
    '    <AuthenticationMethods>',
    '      <AuthenticationMethod>',
    '        <EAPMethod>',
    '          <Type>13</Type>',
    '        </EAPMethod>',
    '        <ServerSideCredential>',
    `          <CA format="X.509" encoding="base64">${bytesToBase64(rootCaDer)}</CA>`,
    serverIds.replace(/^ {8}/gm, '          '),
    '        </ServerSideCredential>',
    '        <ClientSideCredential>',
    `          <ClientCertificate format="PKCS12" encoding="base64">${bytesToBase64(clientP12)}</ClientCertificate>`,
    '        </ClientSideCredential>',
    '      </AuthenticationMethod>',
    '    </AuthenticationMethods>',
    '    <CredentialApplicability>',
    '      <IEEE80211>',
    '        <SSID>eduroam</SSID>',
    '        <MinRSNProto>CCMP</MinRSNProto>',
    '      </IEEE80211>',
    '    </CredentialApplicability>',
    '  </EAPIdentityProvider>',
    '</EAPIdentityProviderList>',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/eduroam/eapConfig.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Build + commit**

```bash
npm run build   # expect exit 0
git add src/services/eduroam/eapConfig.ts src/services/eduroam/eapConfig.test.ts
git commit -m "feat(eduroam): .eap-config generator for geteduroam (EAP-TLS, no embedded passphrase)"
```

---

## Task 2: `buildTransferUrl` gains a format argument

**Files:**
- Modify: `src/api/eduroamTransfer.ts`
- Test: `src/api/eduroamTransfer.test.ts`

**Interfaces:**
- Consumes: existing `RECEIVER_URL` constant in `eduroamTransfer.ts`.
- Produces: `type TransferFormat = 'ios' | 'android'` and `buildTransferUrl(id: string, fmt?: TransferFormat): string` (default `'ios'`, unchanged URL).

- [ ] **Step 1: Write the failing test**

```ts
// src/api/eduroamTransfer.test.ts  (append; create the file with this content if it does not exist)
import { describe, it, expect } from 'vitest';
import { buildTransferUrl } from './eduroamTransfer';

describe('buildTransferUrl format', () => {
  it('defaults to the iOS URL with no fmt param (back-compat)', () => {
    const url = buildTransferUrl('abc');
    expect(url).toContain('?id=abc');
    expect(url).not.toContain('fmt=');
  });

  it('appends fmt=android for the Android target', () => {
    const url = buildTransferUrl('abc', 'android');
    expect(url).toContain('?id=abc');
    expect(url).toContain('&fmt=android');
  });
});
```

> If `src/api/eduroamTransfer.test.ts` already exists, append only the `describe` block above (keep its existing imports/tests).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/eduroamTransfer.test.ts`
Expected: FAIL — `buildTransferUrl` takes the wrong number of args / `fmt=android` not present.

- [ ] **Step 3: Apply the change**

In `src/api/eduroamTransfer.ts`, replace the existing `buildTransferUrl` with:

```ts
/** Which on-phone format the receiver should serve this transfer as. */
export type TransferFormat = 'ios' | 'android';

/**
 * The QR target: the receiver endpoint for this transfer id. `fmt` selects the
 * response MIME/filename on the receiver (`ios` = Apple config profile, the
 * default and unchanged; `android` = `.eap-config` for geteduroam). The hint is
 * not a secret — the uploaded bytes are identical regardless.
 */
export function buildTransferUrl(id: string, fmt: TransferFormat = 'ios'): string {
  const base = `${RECEIVER_URL}?id=${encodeURIComponent(id)}`;
  return fmt === 'ios' ? base : `${base}&fmt=${fmt}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/api/eduroamTransfer.test.ts`
Expected: PASS (both new tests; any pre-existing tests still green).

- [ ] **Step 5: Build + commit**

```bash
npm run build   # expect exit 0
git add src/api/eduroamTransfer.ts src/api/eduroamTransfer.test.ts
git commit -m "feat(eduroam): buildTransferUrl format arg (fmt=android), iOS URL unchanged"
```

---

## Task 3: Receiver edge function serves the right MIME per `?fmt=`

**Files:**
- Modify: `supabase/functions/eduroam-receive/index.ts`

**Interfaces:**
- Consumes: the existing `take_eduroam_transfer` RPC + base64 payload (unchanged).
- Produces: a `?fmt=` → `{ contentType, filename }` mapping; default (`ios`/absent) is byte-for-byte the current Apple response.

There is no Vitest harness for Deno edge functions; this task is verified by code review + the manual curl in Task 7. Keep the change minimal and the iOS default identical.

- [ ] **Step 1: Add the format mapping and use it in the response**

Replace the final `return new Response(...)` block (the Apple-MIME response at the end of the handler) with:

```ts
  // Format hint from the QR URL selects the MIME/filename the phone receives.
  // ios (default) = Apple config profile (unchanged); android = geteduroam .eap-config.
  const fmt = new URL(req.url).searchParams.get('fmt') ?? 'ios';
  const served =
    fmt === 'android'
      ? { contentType: 'application/eap-config', filename: 'eduroam.eap-config' }
      : { contentType: 'application/x-apple-aspen-config', filename: 'eduroam-reis.mobileconfig' };

  return new Response(bytes, {
    headers: {
      'Content-Type': served.contentType,
      'Content-Disposition': `attachment; filename="${served.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
```

(Leave everything above it — the `id` check, the `take_eduroam_transfer` fetch, the base64→bytes loop — unchanged.)

- [ ] **Step 2: Update the file's top comment**

Add one line to the header comment noting the `?fmt=` behavior, e.g. after the existing description:

```ts
// The `?fmt=` query param selects the served type: ios (default) = Apple config
// profile; android = application/eap-config for the geteduroam app.
```

- [ ] **Step 3: Deploy the function**

Redeploy `eduroam-receive` to the `reis-notifications` Supabase project (`zvbpgkmnrqyprtkyxkwn`) via the normal deploy path (Supabase MCP `deploy_edge_function` or `supabase functions deploy eduroam-receive`). Keep `verify_jwt=false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/eduroam-receive/index.ts
git commit -m "feat(eduroam): receiver serves application/eap-config when fmt=android"
```

---

## Task 4: Hook — add the `'android'` target and `run('android')`

**Files:**
- Modify: `src/hooks/data/useEduroamSetup.ts`

**Interfaces:**
- Consumes: `fetchEduroamCertMaterial()`, `generateEapConfig()` (Task 1), `putTransfer()`, `buildTransferUrl(id, fmt)` (Task 2), `QRCode.toDataURL`.
- Produces: `EduroamTarget = 'mac' | 'ios' | 'android'`; the existing hook return shape is unchanged (callers use `run`, `target`, `selectTarget`, `qrDataUrl`, `password`, etc.).

- [ ] **Step 1: Widen the target type and import the generator**

Add the import near the existing eduroam imports:

```ts
import { generateEapConfig } from '../../services/eduroam/eapConfig';
```

Change the type union:

```ts
/** Which device the student is setting up — not necessarily the desktop's OS. */
export type EduroamTarget = 'mac' | 'ios' | 'android';
```

- [ ] **Step 2: Handle the android branch in `run`**

Inside `run`, replace the `if (t === 'ios') { ... } else { ... }` block with:

```ts
      if (t === 'ios') {
        const id = await putTransfer(new TextEncoder().encode(xml));
        setQrDataUrl(await QRCode.toDataURL(buildTransferUrl(id, 'ios'), { margin: 2, width: 320 }));
      } else if (t === 'android') {
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        const id = await putTransfer(new TextEncoder().encode(eap));
        setQrDataUrl(await QRCode.toDataURL(buildTransferUrl(id, 'android'), { margin: 2, width: 320 }));
      } else {
        saveAs(new Blob([xml], { type: 'application/x-apple-aspen-config' }), 'eduroam-reis.mobileconfig');
      }
```

(The `const xml = generateEduroamMobileconfig(...)` line above stays — iOS and Mac still use it; only Android uses the new `eap`.)

- [ ] **Step 3: Build + typecheck**

Run: `npm run build` (expect exit 0) and `npm run typecheck` (expect no errors).
Expected: compiles; `EduroamTarget` now includes `'android'`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/data/useEduroamSetup.ts
git commit -m "feat(eduroam): hook handles the android target (generate .eap-config + QR)"
```

---

## Task 5: Android transfer panel component

**Files:**
- Create: `src/components/Eduroam/AndroidTransfer.tsx`

**Interfaces:**
- Consumes: `useTranslation`, `PasswordChip`, `EduroamStatus` (from `../../hooks/data/useEduroamSetup`), and the i18n keys added in Task 6 (`eduroam.androidIntro`, `androidGenerate`, `androidReady`, `androidStep0`, `androidStep1`, `androidStep2`, `androidStep3`, `androidStep4`, `getEduroam`, plus reused `preparing`, `regenerate`).
- Produces: `export function AndroidTransfer(props: { status: EduroamStatus; qrDataUrl: string | null; password: string | null; onGenerate: () => void }): JSX.Element`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/Eduroam/AndroidTransfer.tsx
import { Loader2, QrCode, ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { PasswordChip } from './PasswordChip';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

interface Props {
  status: EduroamStatus;
  qrDataUrl: string | null;
  password: string | null;
  onGenerate: () => void;
}

const GETEDUROAM_PLAY_URL = 'https://play.google.com/store/apps/details?id=app.eduroam.geteduroam';

/** Android path: generate .eap-config, upload, show the QR + geteduroam steps. */
export function AndroidTransfer({ status, qrDataUrl, password, onGenerate }: Props) {
  const { t } = useTranslation();

  if (status !== 'done' || !qrDataUrl) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-base-content/70">{t('eduroam.androidIntro')}</p>
        <a className="link link-primary text-sm inline-flex items-center gap-1" href={GETEDUROAM_PLAY_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4" /> {t('eduroam.getEduroam')}
        </a>
        <button className="btn btn-primary btn-lg gap-2" disabled={status === 'working'} onClick={onGenerate}>
          {status === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {status === 'working' ? t('eduroam.preparing') : t('eduroam.androidGenerate')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="alert alert-success text-sm">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{t('eduroam.androidReady')}</span>
      </div>
      <div className="self-center bg-white p-3 rounded-xl">
        <img src={qrDataUrl} alt="eduroam QR" width={240} height={240} />
      </div>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>{t('eduroam.androidStep0')}</li>
        <li>{t('eduroam.androidStep1')}</li>
        <li>{t('eduroam.androidStep2')}</li>
        <li>
          {t('eduroam.androidStep3')}
          {password && <PasswordChip password={password} />}
        </li>
        <li>{t('eduroam.androidStep4')}</li>
      </ol>
      <button className="btn btn-ghost btn-sm self-start" onClick={onGenerate}>
        {t('eduroam.regenerate')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exit 0 (the i18n keys resolve to fallbacks until Task 6, which is fine for the build).

- [ ] **Step 3: Commit**

```bash
git add src/components/Eduroam/AndroidTransfer.tsx
git commit -m "feat(eduroam): Android transfer panel (QR + geteduroam steps)"
```

---

## Task 6: Wire the Android tab + i18n strings + privacyNote fix

**Files:**
- Modify: `src/components/Eduroam/EduroamSetup.tsx`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `AndroidTransfer` (Task 5), the hook's `target`/`selectTarget`/`run` (Task 4).
- Produces: a visible third tab; no new exported symbols.

- [ ] **Step 1: Add the i18n keys (English)**

In `src/i18n/locales/en.json`, inside the `"eduroam"` object, add these keys (anywhere after `iosStep4`) and FIX the inaccurate privacy note:

```jsonc
    "targetAndroid": "Android",
    "androidIntro": "Generate a QR code, scan it with your Android phone, and open the file in the geteduroam app.",
    "getEduroam": "Install the geteduroam app (Google Play)",
    "androidGenerate": "Create QR code",
    "androidReady": "Scan this with your Android phone camera.",
    "androidStep0": "Install the geteduroam app from Google Play first (link above).",
    "androidStep1": "Open the Camera (or a QR scanner), point it at the QR code, and tap the link.",
    "androidStep2": "Let the eduroam.eap-config file download, then tap it to open it in geteduroam.",
    "androidStep3": "When geteduroam asks for the certificate password, enter:",
    "androidStep4": "geteduroam installs the profile and your phone joins eduroam.",
```

And change the existing `privacyNote` value to drop the false "encrypted transfer" claim:

```jsonc
    "privacyNote": "Everything is generated on your device and your private key stays protected by a password only you enter on install. The transfer link is one-time and expires within minutes."
```

- [ ] **Step 2: Add the i18n keys (Czech)**

In `src/i18n/locales/cs.json`, inside the `"eduroam"` object, add:

```jsonc
    "targetAndroid": "Android",
    "androidIntro": "Vygenerujte QR kód, naskenujte ho telefonem s Androidem a otevřete soubor v aplikaci geteduroam.",
    "getEduroam": "Nainstalujte aplikaci geteduroam (Google Play)",
    "androidGenerate": "Vytvořit QR kód",
    "androidReady": "Naskenujte fotoaparátem na telefonu s Androidem.",
    "androidStep0": "Nejprve nainstalujte aplikaci geteduroam z Google Play (odkaz výše).",
    "androidStep1": "Otevřete Fotoaparát (nebo QR čtečku), namiřte na QR kód a klepněte na odkaz.",
    "androidStep2": "Nechte stáhnout soubor eduroam.eap-config a klepnutím ho otevřete v aplikaci geteduroam.",
    "androidStep3": "Až se geteduroam zeptá na heslo certifikátu, zadejte:",
    "androidStep4": "geteduroam nainstaluje profil a telefon se připojí k eduroam.",
```

And change the existing `privacyNote`:

```jsonc
    "privacyNote": "Vše se generuje ve vašem zařízení a váš soukromý klíč je chráněn heslem, které zadáte jen vy při instalaci. Přenosový odkaz je jednorázový a vyprší během několika minut."
```

- [ ] **Step 3: Add the Android tab and panel in EduroamSetup.tsx**

In `src/components/Eduroam/EduroamSetup.tsx`:

a) Add `Tablet` to the lucide import line and import the panel:

```ts
import { Wifi, Smartphone, Laptop, Tablet, AlertTriangle } from 'lucide-react';
import { AndroidTransfer } from './AndroidTransfer';
```

b) Add a third tab button after the Mac tab button (inside the `role="tablist"` div):

```tsx
          <button
            role="tab"
            className={`tab gap-2 ${target === 'android' ? 'tab-active' : ''}`}
            onClick={() => selectTarget('android')}
          >
            <Tablet className="w-4 h-4" /> {t('eduroam.targetAndroid')}
          </button>
```

c) Replace the `target === 'ios' ? (...) : (<MacInstall .../>)` ternary with an explicit three-way render:

```tsx
        {target === 'ios' && (
          <IosTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('ios')} />
        )}
        {target === 'android' && (
          <AndroidTransfer status={status} qrDataUrl={qrDataUrl} password={password} onGenerate={() => run('android')} />
        )}
        {target === 'mac' && (
          <MacInstall
            status={status}
            password={password}
            guideHref={guideHref}
            onDownload={() => run('mac')}
            onOpenSettings={openProfilesSettings}
          />
        )}
```

- [ ] **Step 4: Build + typecheck + full eduroam test run**

Run:
```bash
npm run build        # expect exit 0
npm run typecheck    # expect no errors
npx vitest run src/services/eduroam/ src/api/eduroamTransfer.test.ts
```
Expected: build/typecheck clean; all eduroam unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Eduroam/EduroamSetup.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(eduroam): Android tab in setup UI + i18n; correct privacy note copy"
```

---

## Task 7: Manual verification on a real Android phone (the goal's DoD — no code)

Performed by the developer with a real Android phone in eduroam range. This is the consent gate: the goal is not complete until the developer confirms it worked.

- [ ] **Step 1: Confirm the desktop flow**

Load the rebuilt extension, open the eduroam tool → **Android** tab → **Create QR code**. A QR appears and the certificate password chip is shown.

- [ ] **Step 2: (optional) curl-verify the receiver MIME**

```bash
# Re-create a transfer via the UI, copy its id from the QR target, then:
curl -sI "https://zvbpgkmnrqyprtkyxkwn.supabase.co/functions/v1/eduroam-receive?id=<ID>&fmt=android" | grep -i content-
```
Expected: `Content-Type: application/eap-config` and `Content-Disposition: attachment; filename="eduroam.eap-config"`.

- [ ] **Step 3: Install geteduroam**

On the Android phone, install **geteduroam** from Google Play (if not already).

- [ ] **Step 4: Scan → download → open in geteduroam**

Scan the QR with the camera → Chrome opens → the `eduroam.eap-config` downloads → tap it → it opens in geteduroam.

- [ ] **Step 5: Passphrase prompt → install → connect**

geteduroam **prompts for the certificate password** (copy from reIS) → import succeeds → the phone joins `eduroam` with working connectivity.

> ⚠️ The one empirical unknown: if geteduroam **errors instead of prompting** when no `<Passphrase>` is present, or won't open the file, record exactly what was seen. Fallback (embed `<Passphrase>` + rely on short TTL) is a separate decision, not this plan.

- [ ] **Step 6: Security spot-check**

Re-scan the same QR after it expires → the receiver returns the "already used or expired" message. The certificate password was never in the upload (typed only in geteduroam).

- [ ] **Step 7: Record consent**

Developer confirms in the PR: "verified on my Android phone — scanned → geteduroam → password → joined eduroam." That explicit confirmation closes the goal.

---

## Self-Review

**Spec coverage:**
- §5.1 component 2 (`.eap-config` generator) → Task 1. ✅
- §5.1 component 3 + §5.3 (`buildTransferUrl` fmt) → Task 2. ✅
- §5.1 component 4 (receiver `?fmt=` MIME) → Task 3. ✅
- §5.1 component 7 (hook `'android'` + `run`) → Task 4. ✅
- §5.1 component 6 (`AndroidTransfer.tsx`) → Task 5. ✅
- §5.1 component 5 + 8 (tab + i18n) → Task 6 (+ privacyNote drift fix). ✅
- §3 constraints (no passphrase, server validation, EAP-TLS 13) → Task 1 tests. ✅
- §4 on-phone flow + §7 verification (incl. the passphrase-prompt unknown + fallback) → Task 7. ✅
- §6 out of scope (Windows, Linux, schema change, embedding passphrase) → no task touches them; iOS/Mac unchanged (Tasks 2/4 keep defaults). ✅

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output. The `.eap-config` XML nesting/namespace is concrete here and flagged in the spec for XSD validation; Task 7 is the real-device proof. ✅

**Type consistency:** `EapConfigInput`/`generateEapConfig` defined in Task 1, consumed unchanged in Task 4. `TransferFormat`/`buildTransferUrl(id, fmt)` defined in Task 2, consumed in Task 4. `EduroamTarget` widened in Task 4, consumed in Tasks 5/6. `AndroidTransfer` prop shape defined in Task 5 matches the call site in Task 6. i18n keys listed in Task 5's Interfaces all created in Task 6. ✅
