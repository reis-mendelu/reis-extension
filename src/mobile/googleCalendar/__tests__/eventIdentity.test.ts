import { describe, expect, it } from 'vitest';
import { base32hex, contentHash, eventId } from '../eventIdentity';

describe('base32hex', () => {
  it('matches RFC 4648 base32hex vectors (lowercased, unpadded)', () => {
    const enc = (s: string) => base32hex(new TextEncoder().encode(s));
    expect(enc('f')).toBe('co');
    expect(enc('fo')).toBe('cpng');
    expect(enc('foobar')).toBe('cpnmuoj1e8');
  });
});

describe('eventId', () => {
  it('is Google-valid: [a-v0-9], 5–1024 chars, kind-prefixed', async () => {
    const id = await eventId('lesson', '123|20261012|09:00');
    expect(id).toMatch(/^l[0-9a-v]{52}$/);
  });
  it('is stable and kind-separated', async () => {
    expect(await eventId('exam', 'x')).toBe(await eventId('exam', 'x'));
    expect((await eventId('exam', 'x')).slice(1)).toBe((await eventId('custom', 'x')).slice(1));
    expect(await eventId('exam', 'x')).not.toBe(await eventId('custom', 'x'));
  });
});

describe('contentHash', () => {
  it('changes with any visible field and is 16 hex', async () => {
    const base = {
      kind: 'lesson' as const,
      key: 'k',
      date: '2026-10-12',
      start: '09:00',
      end: '10:50',
      title: 'A',
      location: 'Q01',
      description: 'reIS',
    };
    const h = await contentHash(base);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(await contentHash({ ...base, location: 'Q02' })).not.toBe(h);
  });
});
