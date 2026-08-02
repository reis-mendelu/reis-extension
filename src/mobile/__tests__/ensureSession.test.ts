import { describe, it, expect, vi } from 'vitest';
import { ensureSession, type SessionDeps } from '../ensureSession';

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAA%2FBBBBBBBBBBBBBBBBBBB';

function deps(over: Partial<SessionDeps> = {}): SessionDeps {
  const remove = vi.fn(async () => {});
  return {
    getStored: vi.fn(async () => undefined),
    save: vi.fn(async () => {}),
    openLogin: vi.fn(async () => {}),
    onPageLoaded: vi.fn(async () => ({ remove })),
    readCookies: vi.fn(async () => ({ UISAuth: TOKEN })),
    closeWebView: vi.fn(async () => {}),
    ...over,
  };
}

describe('ensureSession', () => {
  it('returns the stored token without opening a login WebView', async () => {
    const d = deps({ getStored: vi.fn(async () => TOKEN) });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.openLogin).not.toHaveBeenCalled();
  });

  it('ignores a stored value too short to be a token and logs in instead', async () => {
    let fire: () => void = () => {};
    const d = deps({
      getStored: vi.fn(async () => 'abc'),
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.openLogin).toHaveBeenCalled();
  });

  it('saves and closes once a page load yields a plausible cookie', async () => {
    let fire: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.save).toHaveBeenCalledWith(TOKEN);
    expect(d.closeWebView).toHaveBeenCalled();
  });

  it('does NOT close while the student is still on the login page', async () => {
    // The pre-login page loads too. Closing on the first load event would kill
    // the WebView before the student can type anything.
    let fire: () => void = () => {};
    let calls = 0;
    const d = deps({
      readCookies: vi.fn(
        async (): Promise<Record<string, string>> => (++calls >= 3 ? { UISAuth: TOKEN } : {}),
      ),
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove: vi.fn(async () => {}) };
      }),
      openLogin: vi.fn(async () => {
        fire();
        fire();
        fire();
      }),
    });
    await expect(ensureSession(d)).resolves.toBe(TOKEN);
    expect(d.closeWebView).toHaveBeenCalledTimes(1);
    expect(d.save).toHaveBeenCalledTimes(1);
  });

  it('removes the page-load listener so a second login does not double-fire', async () => {
    const remove = vi.fn(async () => {});
    let fire: () => void = () => {};
    const d = deps({
      onPageLoaded: vi.fn(async (cb: () => void) => {
        fire = cb;
        return { remove };
      }),
      openLogin: vi.fn(async () => {
        fire();
      }),
    });
    await ensureSession(d);
    expect(remove).toHaveBeenCalled();
  });
});
