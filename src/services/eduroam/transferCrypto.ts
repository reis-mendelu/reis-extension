// Zero-knowledge transfer crypto for the eduroam desktop→phone pipeline.
// The desktop encrypts the .mobileconfig under a fresh AES-256-GCM key; only the
// CIPHERTEXT is uploaded to Supabase. The key travels solely in the QR URL
// fragment (#...) and is never sent to any server. The phone re-derives it from
// the fragment and decrypts locally. See the receiver page for the phone side.

import { bytesToBase64 } from './base64';

/** Standard base64 → url-safe (no +, /, or = padding). */
function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** url-safe base64 → bytes. */
function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface EncryptedTransfer {
  /** Opaque random lookup handle for the ciphertext (safe in the URL path). */
  id: string;
  /** iv(12 bytes) ‖ ciphertext‖GCM-tag — the only thing uploaded. */
  payload: Uint8Array;
  /** Raw AES-256 key, url-safe base64. Belongs ONLY in the QR fragment. */
  keyB64url: string;
}

/**
 * Encrypt profile bytes under a fresh AES-256-GCM key + random 96-bit IV.
 * Returns the upload payload (iv‖ciphertext) plus the key to embed in the QR
 * fragment. The key is never persisted nor transmitted by this module.
 */
export async function encryptProfile(bytes: Uint8Array): Promise<EncryptedTransfer> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const payload = new Uint8Array(iv.length + ct.length);
  payload.set(iv, 0);
  payload.set(ct, iv.length);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return { id: crypto.randomUUID(), payload, keyB64url: bytesToBase64Url(raw) };
}

/**
 * Decrypt a transfer payload with the url-safe base64 key from the fragment.
 * Throws if the key is wrong or the ciphertext was tampered with (GCM auth).
 */
export async function decryptProfile(payload: Uint8Array, keyB64url: string): Promise<Uint8Array> {
  const raw = base64UrlToBytes(keyB64url);
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = payload.slice(0, 12);
  const ct = payload.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new Uint8Array(pt);
}
