import { describe, it, expect, vi } from 'vitest';
import { signInToIskam, type IskamLoginDeps } from '../iskamLogin';
import { LoginCancelledError, LoginUnreachableError } from '../../ensureSession';
import type { IskamJar } from '../iskamJar';

type Cookies = { iskam: Record<string, string>; idp: Record<string, string> };

function harness(cookies: Cookies[]) {
  let onLoad: () => void = () => {};
  let onDismiss: () => void = () => {};
  const reads = [...cookies];
  const deps = {
    open: vi.fn(async () => {}),
    onPageLoaded: vi.fn(async (cb: () => void) => {
      onLoad = cb;
      return { remove: vi.fn(async () => {}) };
    }),
    onDismissed: vi.fn(async (cb: () => void) => {
      onDismiss = cb;
      return { remove: vi.fn(async () => {}) };
    }),
    readCookies: vi.fn(async (): Promise<Cookies> => reads.shift() ?? { iskam: {}, idp: {} }),
    save: vi.fn(async (_jar: IskamJar, _basedOn: number) => true),
    generation: vi.fn(() => 0),
    forgetIskamCookies: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    firstLoadTimeoutMs: 50,
  } satisfies IskamLoginDeps;
  return { deps, load: () => onLoad(), dismiss: () => onDismiss() };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('signInToIskam', () => {
  it('keeps waiting through the password page, then saves both jars and closes once the ticket appears', async () => {
    const h = harness([
      { iskam: {}, idp: {} },
      {
        iskam: { '.ISKAMASPXAUTH': 't', _shibsession_ab: 'sp' },
        idp: { shib_idp_session: 's', shib_idp_persistent_ss: 'p' },
      },
    ]);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await tick();
    expect(h.deps.save).not.toHaveBeenCalled();
    h.load();
    await done;
    const jar = h.deps.save.mock.calls[0]![0];
    expect(
      jar
        .filter((c) => c.host === 'webiskam.mendelu.cz')
        .map((c) => c.name)
        .sort()
    ).toEqual(['.ISKAMASPXAUTH', '_shibsession_ab']);
    const idp = jar.filter((c) => c.host === 'alibaba.mendelu.cz');
    expect(idp).toHaveLength(2);
    expect(idp.every((c) => c.path === '/idp')).toBe(true);
    expect(h.deps.close).toHaveBeenCalled();
  });

  it('rejects with LoginCancelledError when the student closes the popup', async () => {
    const h = harness([]);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    h.dismiss();
    await expect(done).rejects.toBeInstanceOf(LoginCancelledError);
    expect(h.deps.save).not.toHaveBeenCalled();
  });

  it('rejects with LoginUnreachableError when the first page never loads', async () => {
    const h = harness([]);
    await expect(signInToIskam(h.deps)).rejects.toBeInstanceOf(LoginUnreachableError);
    expect(h.deps.close).toHaveBeenCalled();
  });

  it('disarms the deadline on the first load, so a slow login (consent page, typing) is never cut off', async () => {
    const h = harness([
      { iskam: {}, idp: {} },
      { iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} },
    ]);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await new Promise((r) => setTimeout(r, 120));
    h.load();
    await expect(done).resolves.toBeUndefined();
  });

  it('our own close after success does not turn into a cancellation', async () => {
    const h = harness([{ iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} }]);
    h.deps.close.mockImplementation(async () => h.dismiss());
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await expect(done).resolves.toBeUndefined();
  });

  // Found on the Pixel, 2026-10-13: the WebView jar is shared with the app's
  // native HTTP and still held the EXPIRED ticket. The first page of the popup
  // (alibaba's password form) "found" it, the popup saved the dead jar and
  // closed itself ~50 ms after opening — every tap on "Zobrazit zůstatek ISIC"
  // looked like nothing happened.
  it('forgets the stale webiskam cookies before opening, so an old ticket is not taken for a login', async () => {
    let webviewJar: Record<string, string> = { '.ISKAMASPXAUTH': 'expired' };
    const h = harness([]);
    h.deps.forgetIskamCookies.mockImplementation(async () => {
      webviewJar = {};
    });
    h.deps.readCookies.mockImplementation(async () => ({ iskam: webviewJar, idp: {} }));
    const done = signInToIskam(h.deps);
    await tick();
    h.load(); // the password form
    await tick();
    expect(h.deps.close).not.toHaveBeenCalled();
    webviewJar = { '.ISKAMASPXAUTH': 'fresh' }; // the student signs in
    h.load();
    await done;
    expect(h.deps.save.mock.calls[0]![0].find((c) => c.name === '.ISKAMASPXAUTH')?.value).toBe(
      'fresh'
    );
    expect(h.deps.forgetIskamCookies.mock.invocationCallOrder[0]).toBeLessThan(
      h.deps.open.mock.invocationCallOrder[0]!
    );
  });

  // PR #548 review: a login finishing after a sign-out wrote its jar back.
  // The save is based on the jar generation from before the popup opened.
  it('saves against the jar generation read before the popup opened', async () => {
    const h = harness([{ iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} }]);
    h.deps.generation.mockReturnValueOnce(7).mockReturnValue(8);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await done;
    expect(h.deps.save.mock.calls[0]![1]).toBe(7);
  });

  it('a sign-out that landed during the login turns the late save into a cancellation', async () => {
    const h = harness([{ iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} }]);
    h.deps.save.mockResolvedValueOnce(false);
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await expect(done).rejects.toBeInstanceOf(LoginCancelledError);
    expect(h.deps.close).toHaveBeenCalled();
  });

  it('a cookie read that fails rejects, and closes the popup', async () => {
    const h = harness([]);
    h.deps.readCookies.mockRejectedValueOnce(new Error('WebView gone'));
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await expect(done).rejects.toThrow('WebView gone');
    expect(h.deps.close).toHaveBeenCalled();
  });

  it('a save that fails still closes the popup before rejecting', async () => {
    const h = harness([{ iskam: { '.ISKAMASPXAUTH': 't' }, idp: {} }]);
    h.deps.save.mockRejectedValueOnce(new Error('keystore'));
    const done = signInToIskam(h.deps);
    await tick();
    h.load();
    await expect(done).rejects.toThrow('keystore');
    expect(h.deps.close).toHaveBeenCalled();
  });

  // PR #548 review: when setup is slow, the deadline can reject first — the
  // popup must then not open behind an "unavailable" row.
  it('does not open the popup once the deadline has already given up', async () => {
    const h = harness([]);
    let releaseSetup!: () => void;
    h.deps.onDismissed.mockImplementationOnce(
      (cb: () => void) =>
        new Promise((r) => {
          releaseSetup = () => r({ remove: vi.fn(async () => {}) });
          void cb;
        })
    );
    const done = signInToIskam(h.deps);
    await expect(done).rejects.toBeInstanceOf(LoginUnreachableError);
    releaseSetup();
    await tick();
    expect(h.deps.open).not.toHaveBeenCalled();
  });
});
