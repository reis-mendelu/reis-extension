import type { NormalizedEvent, ReisKind } from './types';

const ALPHABET = '0123456789abcdefghijklmnopqrstuv'; // Google event-id alphabet
const PREFIX: Record<ReisKind, string> = { lesson: 'l', exam: 'e', custom: 'c' };

export function base32hex(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return Array.from(await sha256(text), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function eventId(kind: ReisKind, key: string): Promise<string> {
  return PREFIX[kind] + base32hex(await sha256(key));
}

/** JSON, not a joined string: own events are free text, so no separator is safe. */
export async function contentHash(n: NormalizedEvent): Promise<string> {
  const canonical = JSON.stringify([
    n.kind,
    n.date,
    n.start,
    n.end,
    n.title,
    n.location,
    n.description,
  ]);
  return (await sha256Hex(canonical)).slice(0, 16);
}
