import { generateKeyPairSync, createVerify } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAscCredentials, signAscToken } from '../ascApi';

function keyFixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const dir = mkdtempSync(join(tmpdir(), 'asc-key-'));
  const keyPath = join(dir, 'AuthKey_TESTKEY123.p8');
  writeFileSync(keyPath, privateKey);
  return { keyPath, publicKey };
}

describe('resolveAscCredentials', () => {
  // Every case here pins ASC_KEY_DIR at an empty directory: the real
  // ~/.appstoreconnect/private_keys holds a key on the machine that releases,
  // and a test that passes or fails depending on whose laptop it runs on is
  // worse than no test.
  const emptyDir = () => mkdtempSync(join(tmpdir(), 'asc-empty-'));

  it('says which variable is missing instead of failing at upload time', () => {
    expect(() => resolveAscCredentials({ ASC_ISSUER_ID: 'i', ASC_KEY_DIR: emptyDir() })).toThrow(
      /ASC_KEY_ID/
    );
    expect(() => resolveAscCredentials({ ASC_KEY_ID: 'k', ASC_KEY_DIR: emptyDir() })).toThrow(
      /ASC_ISSUER_ID/
    );
  });

  it('lists every path it searched when the .p8 is absent', () => {
    expect(() =>
      resolveAscCredentials({ ASC_KEY_ID: 'ABC123', ASC_ISSUER_ID: 'i', ASC_KEY_DIR: emptyDir() })
    ).toThrow(/AuthKey_ABC123\.p8/);
  });

  it('infers the key id from the only installed .p8', () => {
    const { keyPath } = keyFixture();
    const creds = resolveAscCredentials({
      ASC_ISSUER_ID: 'issuer-uuid',
      ASC_KEY_DIR: dirname(keyPath),
    });
    expect(creds.keyId).toBe('TESTKEY123');
    expect(creds.keyPath).toBe(keyPath);
  });

  it('refuses to guess when two keys are installed', () => {
    const { keyPath } = keyFixture();
    const dir = dirname(keyPath);
    writeFileSync(join(dir, 'AuthKey_OTHERKEY.p8'), 'second key');
    expect(() => resolveAscCredentials({ ASC_ISSUER_ID: 'i', ASC_KEY_DIR: dir })).toThrow(
      /ASC_KEY_ID/
    );
  });

  it('accepts an explicit key path', () => {
    const { keyPath } = keyFixture();
    const creds = resolveAscCredentials({
      ASC_KEY_ID: 'TESTKEY123',
      ASC_ISSUER_ID: 'issuer-uuid',
      ASC_KEY_PATH: keyPath,
    });
    expect(creds).toEqual({ keyId: 'TESTKEY123', issuerId: 'issuer-uuid', keyPath });
  });
});

describe('signAscToken', () => {
  it('produces an ES256 JWT Apple can verify (raw r||s, not DER)', () => {
    const { keyPath, publicKey } = keyFixture();
    const creds = { keyId: 'TESTKEY123', issuerId: 'issuer-uuid', keyPath };
    const token = signAscToken(creds, 1_770_000_000_000);

    const [rawHeader, rawClaims, rawSignature] = token.split('.');
    const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    expect(decode(rawHeader)).toEqual({ alg: 'ES256', kid: 'TESTKEY123', typ: 'JWT' });
    expect(decode(rawClaims).aud).toBe('appstoreconnect-v1');

    const signature = Buffer.from(rawSignature, 'base64url');
    // 64 bytes = r||s. A DER signature is ~70 bytes and is what a naive
    // implementation produces; Apple answers those with a bare 401.
    expect(signature).toHaveLength(64);
    const verified = createVerify('SHA256')
      .update(`${rawHeader}.${rawClaims}`)
      .verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    expect(verified).toBe(true);
  });
});
