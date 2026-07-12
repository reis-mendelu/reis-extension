import { describe, it, expect, vi } from 'vitest';
import { createCookieFetch } from '../nodeRuntime';

describe('createCookieFetch', () => {
  it('adds the Cookie header for is.mendelu.cz requests', async () => {
    const base = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const f = createCookieFetch('ISSESSID=abc', base);
    await f('https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz');
    const init = (base as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(new Headers(init.headers).get('Cookie')).toBe('ISSESSID=abc');
  });

  it('does NOT add cookies for other hosts', async () => {
    const base = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const f = createCookieFetch('ISSESSID=abc', base);
    await f('https://example.com/');
    const init = (base as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] ?? {};
    expect(new Headers(init.headers ?? {}).get('Cookie')).toBeNull();
  });

  it('preserves caller-supplied headers', async () => {
    const base = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const f = createCookieFetch('ISSESSID=abc', base);
    await f('https://is.mendelu.cz/x', { headers: { 'accept-language': 'cs' } });
    const init = (base as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const h = new Headers(init.headers);
    expect(h.get('accept-language')).toBe('cs');
    expect(h.get('Cookie')).toBe('ISSESSID=abc');
  });
});
