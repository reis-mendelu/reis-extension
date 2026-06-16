import { describe, it, expect } from 'vitest';
import { encryptProfile, decryptProfile } from './transferCrypto';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe('transferCrypto', () => {
  it('round-trips a payload through encrypt → decrypt', async () => {
    const profile = enc('<?xml version="1.0"?><plist>eduroam</plist>');
    const { id, payload, keyB64url } = await encryptProfile(profile);
    const out = await decryptProfile(payload, keyB64url);
    expect(dec(out)).toBe('<?xml version="1.0"?><plist>eduroam</plist>');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('uses a fresh key + IV each call (ciphertext differs for same input)', async () => {
    const profile = enc('same bytes');
    const a = await encryptProfile(profile);
    const b = await encryptProfile(profile);
    expect(a.keyB64url).not.toBe(b.keyB64url);
    expect(a.id).not.toBe(b.id);
    // payload carries a random 12-byte IV prefix, so even the head differs
    expect(Array.from(a.payload)).not.toEqual(Array.from(b.payload));
  });

  it('emits a url-safe base64 key (no +, /, or = padding)', async () => {
    const { keyB64url } = await encryptProfile(enc('x'));
    expect(keyB64url).not.toMatch(/[+/=]/);
  });

  it('prefixes the payload with a 12-byte IV', async () => {
    const profile = enc('hello');
    const { payload } = await encryptProfile(profile);
    // 12-byte IV + ciphertext + 16-byte GCM tag, all > 12
    expect(payload.length).toBeGreaterThan(12 + 16);
  });

  it('fails to decrypt with the wrong key', async () => {
    const { payload } = await encryptProfile(enc('secret'));
    const wrong = (await encryptProfile(enc('other'))).keyB64url;
    await expect(decryptProfile(payload, wrong)).rejects.toBeDefined();
  });

  it('fails to decrypt tampered ciphertext (GCM auth)', async () => {
    const { payload, keyB64url } = await encryptProfile(enc('secret'));
    payload[payload.length - 1] ^= 0xff; // flip a tag byte
    await expect(decryptProfile(payload, keyB64url)).rejects.toBeDefined();
  });
});
