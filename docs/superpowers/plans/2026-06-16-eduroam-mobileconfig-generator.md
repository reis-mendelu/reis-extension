# eduroam `.mobileconfig` Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, dependency-free TypeScript module that emits a valid macOS `.mobileconfig` installing MENDELU's root CA, the student's client PKCS#12, and an EAP-TLS `eduroam` Wi-Fi payload.

**Architecture:** Four small files under `src/services/eduroam/` — a portable base64 encoder, a minimal plist serializer, shared types, and the generator that assembles three payloads into one profile. Environment-agnostic (no Node-only or browser-only APIs except `crypto.randomUUID`, available in both) so it drops into the extension UI later unchanged. TDD throughout with vitest.

**Tech Stack:** TypeScript (strict), Vitest (`globals: true`, happy-dom), no new dependencies. Validation via macOS `plutil`.

**Spec:** `docs/superpowers/specs/2026-06-16-eduroam-mobileconfig-generator-design.md`

**Branch:** `feat/eduroam-mobileconfig` (already created)

---

## Notes for the implementer

- Tests are **co-located** next to source as `<name>.test.ts`. Run a single file with
  `npx vitest run <path>`. `describe`/`it`/`expect` are global (`globals: true`) but the
  tests below import them explicitly — that is fine.
- The generator does **not** parse the cert bytes; it only base64-embeds them. So unit
  and lint tests can use arbitrary `Uint8Array` bytes. Real cert material only matters for
  the manual install test (Task 6).
- `plutil -lint` validates plist **syntax only**, not certificate contents — arbitrary
  bytes still lint OK.
- Every file stays under the 200-line Iron Rule. No barrels / re-export files — import
  directly from each file.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/services/eduroam/base64.ts` | `bytesToBase64(Uint8Array): string` — portable, manual table |
| `src/services/eduroam/base64.test.ts` | base64 vectors |
| `src/services/eduroam/plist.ts` | plist node constructors + `serializePlist()` |
| `src/services/eduroam/plist.test.ts` | serializer + escaping |
| `src/services/eduroam/types.ts` | `EduroamProfileInput` |
| `src/services/eduroam/mobileconfig.ts` | `generateEduroamMobileconfig(input): string` |
| `src/services/eduroam/mobileconfig.test.ts` | generator behavior |
| `src/services/eduroam/mobileconfig.lint.test.ts` | macOS `plutil` validation (gated) |
| `src/services/eduroam/genRealProfile.test.ts` | writes a profile from real certs (env-gated, manual) |

---

## Task 1: Portable base64 encoder

**Files:**
- Create: `src/services/eduroam/base64.ts`
- Test: `src/services/eduroam/base64.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/eduroam/base64.test.ts
import { describe, it, expect } from 'vitest';
import { bytesToBase64 } from './base64';

const enc = (s: string) => new TextEncoder().encode(s);

describe('bytesToBase64', () => {
  it('encodes empty input to empty string', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });
  it('encodes 3-byte group with no padding', () => {
    expect(bytesToBase64(enc('Man'))).toBe('TWFu');
  });
  it('encodes 2-byte remainder with one pad', () => {
    expect(bytesToBase64(enc('Ma'))).toBe('TWE=');
  });
  it('encodes 1-byte remainder with two pads', () => {
    expect(bytesToBase64(enc('M'))).toBe('TQ==');
  });
  it('handles bytes above 127', () => {
    expect(bytesToBase64(new Uint8Array([0xff, 0xff, 0xff]))).toBe('////');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/eduroam/base64.test.ts`
Expected: FAIL — cannot find module `./base64`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/eduroam/base64.ts
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encode bytes to standard base64 (with padding). Works in browser and Node. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/eduroam/base64.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/eduroam/base64.ts src/services/eduroam/base64.test.ts
git commit -m "feat(eduroam): portable base64 encoder"
```

---

## Task 2: Minimal plist serializer

**Files:**
- Create: `src/services/eduroam/plist.ts`
- Test: `src/services/eduroam/plist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/eduroam/plist.test.ts
import { describe, it, expect } from 'vitest';
import { pdict, parr, pstr, pint, pbool, pdata, serializePlist } from './plist';

describe('serializePlist', () => {
  it('escapes & and < in string values', () => {
    const xml = serializePlist(pdict([['k', pstr('a & b < c')]]));
    expect(xml).toContain('<key>k</key>');
    expect(xml).toContain('<string>a &amp; b &lt; c</string>');
  });

  it('renders integer, bool, data and array nodes', () => {
    const xml = serializePlist(
      pdict([
        ['n', pint(13)],
        ['b', pbool(false)],
        ['d', pdata('TWFu')],
        ['a', parr([pstr('x'), pstr('y')])],
      ]),
    );
    expect(xml).toContain('<integer>13</integer>');
    expect(xml).toContain('<false/>');
    expect(xml).toContain('<data>TWFu</data>');
    expect(xml).toContain('<array>');
    expect(xml).toMatch(/<string>x<\/string>[\s\S]*<string>y<\/string>/);
  });

  it('wraps output in the plist XML + DOCTYPE header', () => {
    const xml = serializePlist(pdict([]));
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"');
    expect(xml).toContain('<plist version="1.0">');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/eduroam/plist.test.ts`
Expected: FAIL — cannot find module `./plist`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/eduroam/plist.ts
export type PlistNode =
  | { t: 'string'; v: string }
  | { t: 'integer'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'data'; v: string }
  | { t: 'array'; v: PlistNode[] }
  | { t: 'dict'; v: Array<[string, PlistNode]> };

export const pstr = (v: string): PlistNode => ({ t: 'string', v });
export const pint = (v: number): PlistNode => ({ t: 'integer', v });
export const pbool = (v: boolean): PlistNode => ({ t: 'bool', v });
export const pdata = (base64: string): PlistNode => ({ t: 'data', v: base64 });
export const parr = (v: PlistNode[]): PlistNode => ({ t: 'array', v });
export const pdict = (v: Array<[string, PlistNode]>): PlistNode => ({ t: 'dict', v });

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(node: PlistNode, indent: string): string {
  switch (node.t) {
    case 'string':
      return `${indent}<string>${escapeXml(node.v)}</string>`;
    case 'integer':
      return `${indent}<integer>${node.v}</integer>`;
    case 'bool':
      return `${indent}${node.v ? '<true/>' : '<false/>'}`;
    case 'data':
      return `${indent}<data>${node.v}</data>`;
    case 'array': {
      if (node.v.length === 0) return `${indent}<array/>`;
      const inner = node.v.map((n) => render(n, indent + '\t')).join('\n');
      return `${indent}<array>\n${inner}\n${indent}</array>`;
    }
    case 'dict': {
      if (node.v.length === 0) return `${indent}<dict/>`;
      const inner = node.v
        .map(([k, n]) => `${indent}\t<key>${escapeXml(k)}</key>\n${render(n, indent + '\t')}`)
        .join('\n');
      return `${indent}<dict>\n${inner}\n${indent}</dict>`;
    }
  }
}

/** Serialize a plist node tree into a complete XML plist document. */
export function serializePlist(root: PlistNode): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    render(root, ''),
    '</plist>',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/eduroam/plist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/eduroam/plist.ts src/services/eduroam/plist.test.ts
git commit -m "feat(eduroam): minimal plist serializer"
```

---

## Task 3: Generator types + `generateEduroamMobileconfig`

**Files:**
- Create: `src/services/eduroam/types.ts`
- Create: `src/services/eduroam/mobileconfig.ts`
- Test: `src/services/eduroam/mobileconfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/eduroam/mobileconfig.test.ts
import { describe, it, expect } from 'vitest';
import { generateEduroamMobileconfig } from './mobileconfig';

const root = new Uint8Array([1, 2, 3]);
const p12 = new Uint8Array([4, 5, 6]);
const fixedUuids = { top: 'TOP', ca: 'CA', p12: 'P12', wifi: 'WIFI' };

describe('generateEduroamMobileconfig', () => {
  it('throws on empty rootCaDer', () => {
    expect(() =>
      generateEduroamMobileconfig({ rootCaDer: new Uint8Array(), clientP12: p12 }),
    ).toThrow(/rootCaDer/);
  });

  it('throws on empty clientP12', () => {
    expect(() =>
      generateEduroamMobileconfig({ rootCaDer: root, clientP12: new Uint8Array() }),
    ).toThrow(/clientP12/);
  });

  it('throws on empty serverNames', () => {
    expect(() =>
      generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, serverNames: [] }),
    ).toThrow(/serverNames/);
  });

  it('defaults the trusted server name to aleph.mendelu.cz', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    expect(xml).toContain('<string>aleph.mendelu.cz</string>');
  });

  it('points the Wi-Fi anchor at the CA payload UUID', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    const i = xml.indexOf('PayloadCertificateAnchorUUID');
    expect(i).toBeGreaterThan(-1);
    expect(xml.slice(i, i + 200)).toContain('<string>CA</string>');
  });

  it('selects the client identity via PayloadCertificateUUID', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    const i = xml.indexOf('<key>PayloadCertificateUUID</key>');
    expect(i).toBeGreaterThan(-1);
    expect(xml.slice(i, i + 80)).toContain('<string>P12</string>');
  });

  it('omits the pkcs12 password (OS prompts at install)', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    expect(xml).not.toContain('Password');
  });

  it('hard-enforces server validation (TLSAllowTrustExceptions false)', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    const i = xml.indexOf('TLSAllowTrustExceptions');
    expect(i).toBeGreaterThan(-1);
    expect(xml.slice(i, i + 40)).toContain('<false/>');
  });

  it('uses EAP-TLS (type 13)', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    expect(xml).toContain('<key>AcceptEAPTypes</key>');
    expect(xml).toContain('<integer>13</integer>');
  });

  it('base64-embeds the cert bytes', () => {
    const xml = generateEduroamMobileconfig({
      rootCaDer: new Uint8Array([0x4d, 0x61, 0x6e]), // "Man"
      clientP12: p12,
      uuids: fixedUuids,
    });
    expect(xml).toContain('<data>TWFu</data>');
  });

  it('generates random UUIDs when none injected', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).not.toContain('<string>TOP</string>');
    expect(xml).toContain('<key>PayloadUUID</key>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/eduroam/mobileconfig.test.ts`
Expected: FAIL — cannot find module `./mobileconfig`.

- [ ] **Step 3: Write the types**

```ts
// src/services/eduroam/types.ts
export interface EduroamProfileInput {
  /** MENDELU root CA, DER-encoded. Also serves as the server-validation anchor. */
  rootCaDer: Uint8Array;
  /** The student's personal certificate + private key, PKCS#12 (.p12) bytes. */
  clientP12: Uint8Array;
  /** Server names the device validates the RADIUS cert against. Default ["aleph.mendelu.cz"]. */
  serverNames?: string[];
  /** Profile display name. Default "MENDELU eduroam (reIS)". */
  displayName?: string;
  /** Top-level PayloadIdentifier prefix. Default "cz.reis.eduroam". */
  identifier?: string;
  /** Inject UUIDs for deterministic output (tests). Defaults to crypto.randomUUID(). */
  uuids?: { top: string; ca: string; p12: string; wifi: string };
}
```

- [ ] **Step 4: Write the generator**

```ts
// src/services/eduroam/mobileconfig.ts
import { bytesToBase64 } from './base64';
import { pdict, parr, pstr, pint, pbool, pdata, serializePlist } from './plist';
import type { EduroamProfileInput } from './types';

const DEFAULT_SERVER_NAMES = ['aleph.mendelu.cz'];
const DEFAULT_DISPLAY_NAME = 'MENDELU eduroam (reIS)';
const DEFAULT_IDENTIFIER = 'cz.reis.eduroam';

const newUuid = (): string => crypto.randomUUID().toUpperCase();

/**
 * Build a macOS .mobileconfig that installs the MENDELU root CA, the client
 * PKCS#12 identity, and an EAP-TLS eduroam Wi-Fi payload referencing both.
 * The .p12 password is intentionally never embedded — macOS prompts at install.
 */
export function generateEduroamMobileconfig(input: EduroamProfileInput): string {
  const { rootCaDer, clientP12 } = input;
  if (!rootCaDer || rootCaDer.length === 0) throw new Error('rootCaDer is empty');
  if (!clientP12 || clientP12.length === 0) throw new Error('clientP12 is empty');

  const serverNames = input.serverNames ?? DEFAULT_SERVER_NAMES;
  if (serverNames.length === 0) throw new Error('serverNames is empty');

  const displayName = input.displayName ?? DEFAULT_DISPLAY_NAME;
  const identifier = input.identifier ?? DEFAULT_IDENTIFIER;
  const ids = input.uuids ?? { top: newUuid(), ca: newUuid(), p12: newUuid(), wifi: newUuid() };

  const caPayload = pdict([
    ['PayloadType', pstr('com.apple.security.root')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(`${identifier}.ca`)],
    ['PayloadUUID', pstr(ids.ca)],
    ['PayloadDisplayName', pstr('MENDELU Root CA')],
    ['PayloadContent', pdata(bytesToBase64(rootCaDer))],
  ]);

  const p12Payload = pdict([
    ['PayloadType', pstr('com.apple.security.pkcs12')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(`${identifier}.identity`)],
    ['PayloadUUID', pstr(ids.p12)],
    ['PayloadDisplayName', pstr('eduroam user certificate')],
    ['PayloadContent', pdata(bytesToBase64(clientP12))],
    // Password key intentionally omitted -> OS prompts at install time.
  ]);

  const wifiPayload = pdict([
    ['PayloadType', pstr('com.apple.wifi.managed')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(`${identifier}.wifi`)],
    ['PayloadUUID', pstr(ids.wifi)],
    ['PayloadDisplayName', pstr('eduroam')],
    ['SSID_STR', pstr('eduroam')],
    ['AutoJoin', pbool(true)],
    ['EncryptionType', pstr('WPA')],
    [
      'EAPClientConfiguration',
      pdict([
        ['AcceptEAPTypes', parr([pint(13)])], // 13 = EAP-TLS
        ['PayloadCertificateAnchorUUID', parr([pstr(ids.ca)])],
        ['TLSTrustedServerNames', parr(serverNames.map((n) => pstr(n)))],
        ['TLSAllowTrustExceptions', pbool(false)],
      ]),
    ],
    ['PayloadCertificateUUID', pstr(ids.p12)], // selects the client identity
  ]);

  const top = pdict([
    ['PayloadType', pstr('Configuration')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(identifier)],
    ['PayloadUUID', pstr(ids.top)],
    ['PayloadDisplayName', pstr(displayName)],
    ['PayloadOrganization', pstr('reIS')],
    ['PayloadContent', parr([caPayload, p12Payload, wifiPayload])],
  ]);

  return serializePlist(top);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/eduroam/mobileconfig.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add src/services/eduroam/types.ts src/services/eduroam/mobileconfig.ts src/services/eduroam/mobileconfig.test.ts
git commit -m "feat(eduroam): mobileconfig generator (EAP-TLS, single MENDELU anchor)"
```

---

## Task 4: macOS `plutil` validation (gated integration test)

**Files:**
- Create: `src/services/eduroam/mobileconfig.lint.test.ts`

- [ ] **Step 1: Write the test (and run it — it should pass once the generator is correct)**

```ts
// src/services/eduroam/mobileconfig.lint.test.ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateEduroamMobileconfig } from './mobileconfig';

function hasPlutil(): boolean {
  try {
    execFileSync('which', ['plutil']);
    return true;
  } catch {
    return false;
  }
}

// Skips automatically on non-macOS / CI without plutil.
describe.runIf(hasPlutil())('mobileconfig plutil validation', () => {
  it('emits a profile that plutil -lint accepts', () => {
    const xml = generateEduroamMobileconfig({
      rootCaDer: new Uint8Array([1, 2, 3, 4, 5]),
      clientP12: new Uint8Array([6, 7, 8, 9, 10]),
    });
    const dir = mkdtempSync(join(tmpdir(), 'reis-eduroam-'));
    const file = join(dir, 'test.mobileconfig');
    writeFileSync(file, xml);
    const out = execFileSync('plutil', ['-lint', file]).toString();
    expect(out).toContain('OK');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/services/eduroam/mobileconfig.lint.test.ts`
Expected (on the Mac): PASS — `plutil -lint` reports `... OK`. On a machine without
`plutil` the suite is skipped (still green).

- [ ] **Step 3: Commit**

```bash
git add src/services/eduroam/mobileconfig.lint.test.ts
git commit -m "test(eduroam): gated plutil validation of generated profile"
```

---

## Task 5: Real-cert profile writer (env-gated, for manual install)

**Files:**
- Create: `src/services/eduroam/genRealProfile.test.ts`

This is not a behavioral test — it is the tool that produces an installable profile from
the real downloaded cert files. It only runs when `REIS_REAL_CERT_DIR` is set, so normal
test runs skip it.

- [ ] **Step 1: Write the gated writer**

```ts
// src/services/eduroam/genRealProfile.test.ts
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateEduroamMobileconfig } from './mobileconfig';

const dir = process.env.REIS_REAL_CERT_DIR;

// Set REIS_REAL_CERT_DIR to a folder containing root-der.der and user-p12.p12
// to emit an installable eduroam-reis.mobileconfig into that same folder.
describe.runIf(!!dir)('generate real eduroam profile (manual)', () => {
  it('writes eduroam-reis.mobileconfig from real cert files', () => {
    const root = new Uint8Array(readFileSync(join(dir!, 'root-der.der')));
    const p12 = new Uint8Array(readFileSync(join(dir!, 'user-p12.p12')));
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12 });
    writeFileSync(join(dir!, 'eduroam-reis.mobileconfig'), xml);
    // eslint-disable-next-line no-console
    console.log('Wrote', join(dir!, 'eduroam-reis.mobileconfig'));
  });
});
```

- [ ] **Step 2: Generate the real profile**

Run:
```bash
REIS_REAL_CERT_DIR=../reis-scraper/eduroam-investigation/files \
  npx vitest run src/services/eduroam/genRealProfile.test.ts
```
Expected: PASS, and `../reis-scraper/eduroam-investigation/files/eduroam-reis.mobileconfig`
now exists. (That directory is gitignored — the profile and certs are never committed.)

- [ ] **Step 3: Verify the real profile lints**

Run: `plutil -lint ../reis-scraper/eduroam-investigation/files/eduroam-reis.mobileconfig`
Expected: `... OK`.

- [ ] **Step 4: Commit**

```bash
git add src/services/eduroam/genRealProfile.test.ts
git commit -m "test(eduroam): env-gated real-cert profile writer for manual install"
```

---

## Task 6: Manual definition-of-done on the M3 (no code)

Not automatable — performed by Dominik on the Apple Silicon Mac, in eduroam range.

- [ ] **Step 1: Run the full unit suite once**

Run: `npx vitest run src/services/eduroam/`
Expected: all suites PASS (lint suite runs; real-profile suite skips without the env var).

- [ ] **Step 2: Open the generated profile**

Run: `open ../reis-scraper/eduroam-investigation/files/eduroam-reis.mobileconfig`
Then: System Settings → General → Device Management (or Privacy & Security → Profiles) →
install "MENDELU eduroam (reIS)".
Expected: macOS prompts **once** for the `.p12` password — enter the extraction password
shown on the UIS cert page (currently `wIp.num.7.uzo`). Profile installs the root CA,
the client identity, and the eduroam Wi-Fi config. (It may show "Unverified" — expected,
the profile is unsigned.)

- [ ] **Step 3: Confirm connectivity**

Expected: the Mac auto-joins `eduroam` and has working internet. The earlier "couldn't
log into eduroam on Mac" failure is resolved (the cause was simply no client cert).

- [ ] **Step 4: Negative test — prove server validation is enforced**

Regenerate a deliberately-wrong profile and install it (remove the previous one first):
```bash
# In a scratch copy, edit serverNames to a wrong value, e.g. via a one-off:
REIS_REAL_CERT_DIR=../reis-scraper/eduroam-investigation/files \
  npx vitest run src/services/eduroam/genRealProfile.test.ts
# then hand-edit the <string>aleph.mendelu.cz</string> in the output to
# <string>wrong.example.com</string> and reinstall.
```
Expected: the Mac **fails** to connect to eduroam — confirming `TLSTrustedServerNames` +
`TLSAllowTrustExceptions=false` are actually enforced (we are not silently trusting any
server). Remove the bad profile and reinstall the correct one afterward.

- [ ] **Step 5: Record the result**

Note in the PR description: install prompted once, both certs + Wi-Fi installed, auto-join
worked, wrong-server profile failed to connect, no private key left the device.

---

## Self-Review

**Spec coverage:**
- §3 module layout (base64, plist, types, mobileconfig) → Tasks 1–3. ✅
- §3 public API + defaults + injectable UUIDs + omitted password → Task 3. ✅
- §3 invariants (one CA payload / anchor==CA UUID, `TLSAllowTrustExceptions=false`,
  no password) → asserted in Task 3 tests. ✅
- §3 error handling (empty rootCaDer/clientP12/serverNames) → Task 3 tests. ✅
- §4 unit tests → Task 3; plutil integration → Task 4; real-bytes generation → Task 5;
  manual DoD incl. negative server-name test → Task 6. ✅
- §5 out-of-scope (UI, UIS automation, signing, other OSes) → not in any task. ✅

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have
expected output. ✅

**Type consistency:** `EduroamProfileInput` fields (`rootCaDer`, `clientP12`,
`serverNames`, `displayName`, `identifier`, `uuids`) used identically across Tasks 3/5;
plist constructors (`pstr/pint/pbool/pdata/parr/pdict/serializePlist`) defined in Task 2
and consumed unchanged in Task 3; `generateEduroamMobileconfig` signature stable across
Tasks 3–6; `bytesToBase64` defined in Task 1, used in Task 3. ✅
