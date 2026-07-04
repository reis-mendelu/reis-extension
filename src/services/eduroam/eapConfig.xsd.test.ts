// Structural gate: the generated .eap-config must validate against the official
// eduroam CAT eap-metadata.xsd (committed alongside this file). This complements
// the geteduroam-model field assertions in eapConfig.test.ts — note the schema is
// LOOSER than geteduroam (it marks version/ProviderInfo optional), so both gates
// are needed. Runs xmllint if present; skips cleanly where it is not (e.g. some CI).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEapConfig } from './eapConfig';

const here = dirname(fileURLToPath(import.meta.url));
const xsd = join(here, 'eap-metadata.xsd');

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('generateEapConfig — XSD validity', () => {
  it.runIf(hasXmllint())('validates against eap-metadata.xsd', () => {
    const xml = generateEapConfig({
      rootCaDer: new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)),
      clientP12: new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff)),
    });
    const file = join(mkdtempSync(join(tmpdir(), 'eap-')), 'sample.eap-config');
    writeFileSync(file, xml);
    // execFileSync throws (non-zero exit) if the document does not validate.
    expect(() => execFileSync('xmllint', ['--noout', '--schema', xsd, file], { stdio: 'pipe' })).not.toThrow();
  });

  it.runIf(hasXmllint())('validates with a ValidUntil element (still valid xs:dateTime)', () => {
    const xml = generateEapConfig({
      rootCaDer: new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)),
      clientP12: new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff)),
      validUntil: new Date('2027-07-04T09:42:47.000Z'),
    });
    expect(xml).toContain('<ValidUntil>2027-07-04T09:42:47</ValidUntil>');
    const file = join(mkdtempSync(join(tmpdir(), 'eap-')), 'sample.eap-config');
    writeFileSync(file, xml);
    expect(() => execFileSync('xmllint', ['--noout', '--schema', xsd, file], { stdio: 'pipe' })).not.toThrow();
  });
});
