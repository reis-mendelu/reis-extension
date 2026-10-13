import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IskamHttpDeps, NativeHttpResponse } from '../iskamHttp';

const store = new Map<string, unknown>();
vi.mock('../../../platform', () => ({
  getPlatform: () => ({
    kind: 'capacitor',
    secureStorage: {
      get: async (k: string) => store.get(k),
      set: async (k: string, v: unknown) => {
        store.set(k, v);
      },
      remove: async (k: string) => {
        store.delete(k);
      },
    },
  }),
}));

const browser = {
  open: vi.fn(async (_o: { url: string }) => {}),
  addListener: vi.fn(),
};
vi.mock('@capacitor/browser', () => ({ Browser: browser }));

import { initTopUp, openGateway } from '../iskamTopUp';
import { __resetIskamJarForTests, saveJar } from '../iskamCookieStore';

const GATE = 'https://gate.gopay.com/gw-ui/rest/v3/123';
function http(r: NativeHttpResponse) {
  return {
    platform: 'ios',
    setCookie: async () => {},
    request: vi.fn(async (_o: Parameters<IskamHttpDeps['request']>[0]) => r),
  } satisfies IskamHttpDeps;
}

describe('initTopUp', () => {
  beforeEach(async () => {
    store.clear();
    __resetIskamJarForTests();
    await saveJar([
      { name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null },
    ]);
  });

  it('sends the XHR GET with the session and returns the validated gateway URL', async () => {
    const h = http({
      status: 200,
      data: `<form action="${GATE}" method="post" id="gopay-payment-button"></form>`,
    });
    expect(await initTopUp(h, 250, 'card')).toEqual({ kind: 'ok', url: GATE });
    const sent = h.request.mock.calls[0]![0];
    expect(sent.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(sent.headers.Cookie).toBe('.ISKAMASPXAUTH=t');
    expect(sent.url).toContain('VybranaMetoda=PAYMENT_CARD');
    expect(sent.url).toContain('CastkaZadana=250');
  });

  it('an empty 200 or a 302 to /Home/Index means the session expired', async () => {
    expect(await initTopUp(http({ status: 200, data: '' }), 1, 'gpay')).toEqual({
      kind: 'expired',
    });
    expect(
      await initTopUp(
        http({ status: 302, headers: { Location: '/Home/Index' }, data: '' }),
        1,
        'gpay'
      )
    ).toEqual({ kind: 'expired' });
  });

  it("rejects a form that points anywhere but GoPay's gateway", async () => {
    const h = http({ status: 200, data: '<form action="https://evil.example/gw-ui/1"></form>' });
    expect(await initTopUp(h, 1, 'card')).toEqual({ kind: 'rejected' });
  });
});

describe('openGateway', () => {
  it('opens the URL and resolves when the browser view is closed', async () => {
    let finished: () => void = () => {};
    const remove = vi.fn(async () => {});
    browser.addListener.mockImplementation(async (_e: string, cb: () => void) => {
      finished = cb;
      return { remove };
    });
    const p = openGateway(GATE);
    await new Promise((r) => setTimeout(r, 0));
    expect(browser.open).toHaveBeenCalledWith({ url: GATE });
    finished();
    await p;
    expect(remove).toHaveBeenCalled();
  });
});
