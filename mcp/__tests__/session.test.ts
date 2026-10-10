import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../login', async (orig) => {
  const real = await orig<typeof import('../login')>();
  return { ...real, loginToIs: vi.fn() };
});
import { loginToIs, IsLoginError } from '../login';
import { createIsSession } from '../session';

const login = vi.mocked(loginToIs);
const IS_URL = 'https://is.mendelu.cz/auth/a.pl';

function page(html: string, url = 'https://is.mendelu.cz/auth/x.pl'): Response {
  const r = new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  Object.defineProperty(r, 'url', { value: url });
  return r;
}
const LOGIN_PAGE = () =>
  page('<input name="credential_1">', 'https://is.mendelu.cz/system/login.pl');
const asFetch = (f: unknown) => f as typeof fetch;
const sentCookie = (native: ReturnType<typeof vi.fn>, call: number) =>
  (native.mock.calls[call]?.[1] as RequestInit | undefined)?.headers as
    Record<string, string> | undefined;

describe('createIsSession', () => {
  beforeEach(() => {
    login.mockReset();
  });

  it('logs in once for concurrent first calls and sends the cookie only to IS', async () => {
    login.mockResolvedValue('UISAuth=tok1');
    const native = vi.fn(async () => page('<html>ok</html>'));
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(native));
    await Promise.all([s.fetch(IS_URL), s.fetch('https://is.mendelu.cz/auth/b.pl')]);
    expect(login).toHaveBeenCalledTimes(1);
    expect(sentCookie(native, 0)?.cookie).toBe('UISAuth=tok1');

    await s.fetch('https://cdn.jsdelivr.net/gh/x.json');
    const cdnInit = native.mock.calls.at(-1) as unknown[] | undefined;
    expect(JSON.stringify(cdnInit?.[1] ?? {})).not.toContain('UISAuth');
  });

  it('keeps headers the caller passed', async () => {
    login.mockResolvedValue('UISAuth=tok1');
    const native = vi.fn(async () => page('<html>ok</html>'));
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(native));
    await s.fetch(IS_URL, { headers: { 'X-Test': '1' } });
    expect(sentCookie(native, 0)).toMatchObject({ 'x-test': '1', cookie: 'UISAuth=tok1' });
  });

  it('re-logs in once on an expired session and retries with the NEW cookie', async () => {
    login.mockResolvedValueOnce('UISAuth=old').mockResolvedValueOnce('UISAuth=new');
    const native = vi
      .fn()
      .mockResolvedValueOnce(LOGIN_PAGE())
      .mockResolvedValueOnce(page('<html>data</html>'));
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(native));
    const res = await s.fetch(IS_URL);
    expect(await res.text()).toBe('<html>data</html>');
    expect(login).toHaveBeenCalledTimes(2);
    expect(sentCookie(native, 1)?.cookie).toBe('UISAuth=new');
  });

  it('gives up after one retry', async () => {
    login.mockResolvedValue('UISAuth=t');
    const native = vi.fn().mockImplementation(async () => LOGIN_PAGE());
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(native));
    const err = await s.fetch(IS_URL).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IsLoginError);
    expect(login).toHaveBeenCalledTimes(2);
  });

  it('never retries bad credentials, on this call or later ones', async () => {
    login.mockImplementation(async () => {
      throw new IsLoginError('bad-credentials', 'm');
    });
    const native = vi.fn();
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(native));
    await expect(s.fetch(IS_URL)).rejects.toMatchObject({ kind: 'bad-credentials' });
    await expect(s.fetch('https://is.mendelu.cz/auth/b.pl')).rejects.toMatchObject({
      kind: 'bad-credentials',
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(native).not.toHaveBeenCalled();
  });

  it('waits 60 s after an unexpected failure before trying again', async () => {
    let t = 0;
    login
      .mockRejectedValueOnce(new IsLoginError('unexpected', 'm'))
      .mockResolvedValueOnce('UISAuth=t');
    const native = vi.fn(async () => page('<html>ok</html>'));
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(native), () => t);
    await expect(s.fetch(IS_URL)).rejects.toMatchObject({ kind: 'unexpected' });
    t = 30_000;
    await expect(s.fetch(IS_URL)).rejects.toMatchObject({ kind: 'unexpected' });
    expect(login).toHaveBeenCalledTimes(1);
    t = 61_000;
    await expect(s.fetch(IS_URL)).resolves.toBeInstanceOf(Response);
    expect(login).toHaveBeenCalledTimes(2);
  });

  it('gives up for good after 3 consecutive unexpected failures', async () => {
    let t = 0;
    login.mockImplementation(async () => {
      throw new IsLoginError('unexpected', 'm');
    });
    const s = createIsSession({ user: 'u', pass: 'p' }, asFetch(vi.fn()), () => t);
    for (let i = 0; i < 3; i++) {
      await expect(s.fetch(IS_URL)).rejects.toMatchObject({ kind: 'unexpected' });
      t += 61_000;
    }
    await expect(s.fetch(IS_URL)).rejects.toMatchObject({ kind: 'unexpected' });
    expect(login).toHaveBeenCalledTimes(3);
  });
});
