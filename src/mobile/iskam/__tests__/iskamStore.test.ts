import { describe, it, expect, vi, beforeEach } from 'vitest';

const runSilentChain = vi.fn();
const signInToIskam = vi.fn();
let platformKind = 'capacitor';
let demo = false;
vi.mock('../iskamSession', () => ({
  runSilentChain: (...a: unknown[]) => runSilentChain(...a),
}));
vi.mock('../iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../iskamLogin', () => ({
  signInToIskam: (...a: unknown[]) => signInToIskam(...a),
  buildIskamLoginDeps: async () => ({}),
}));
const initTopUp = vi.fn();
const openGateway = vi.fn();
vi.mock('../iskamTopUp', () => ({
  initTopUp: (...a: unknown[]) => initTopUp(...a),
  openGateway: (...a: unknown[]) => openGateway(...a),
}));
vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: platformKind }) }));
vi.mock('../../../errors/demoMode', () => ({ isDemoMode: () => demo }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { useIskamStore } from '../iskamStore';
import { LoginCancelledError, LoginUnreachableError } from '../../ensureSession';

const KONTA = `<div class="vyskaRiadkuKonto"><div>Hlavní konto</div><div>245,00 Kč</div><a href="/Platby/NabitiKonta/0">Nabít</a></div>`;
const s = () => useIskamStore.getState();

describe('useIskamStore', () => {
  beforeEach(() => {
    runSilentChain.mockReset();
    signInToIskam.mockReset();
    initTopUp.mockReset();
    openGateway.mockReset();
    platformKind = 'capacitor';
    demo = false;
    s().reset();
  });

  it('shows the balance when the chain is live', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    const p = s().check();
    expect(s().status).toBe('checking');
    await p;
    expect(s().status).toBe('balance');
    expect(s().balance).toEqual({ amount: 245 });
  });

  it.each([
    [{ state: 'dead' }, 'signed-out'],
    [{ state: 'unreachable' }, 'unavailable'],
    [
      { state: 'live', kontaHtml: '<div class="vyskaRiadkuKonto">changed page</div>' },
      'unavailable',
    ],
  ])('maps %j to %s with no balance', async (result, status) => {
    runSilentChain.mockResolvedValue(result);
    await s().check();
    expect(s().status).toBe(status);
    expect(s().balance).toBeNull();
  });

  it('stays hidden in demo mode and off Capacitor, without touching WebISKAM', async () => {
    demo = true;
    await s().check();
    expect(s().status).toBe('hidden');
    demo = false;
    platformKind = 'web';
    await s().check();
    expect(s().status).toBe('hidden');
    expect(runSilentChain).not.toHaveBeenCalled();
  });

  it('ignores a check that finishes after the sheet was closed (reset)', async () => {
    let finish!: (v: unknown) => void;
    runSilentChain.mockReturnValue(new Promise((r) => (finish = r)));
    const p = s().check();
    await new Promise((r) => setTimeout(r, 0));
    s().reset();
    finish({ state: 'live', kontaHtml: KONTA });
    await p;
    expect(s().status).toBe('hidden');
    expect(s().balance).toBeNull();
  });

  it('never shows the previous balance while re-checking', async () => {
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: KONTA });
    await s().check();
    runSilentChain.mockReturnValueOnce(new Promise(() => {}));
    void s().check();
    expect(s().status).toBe('checking');
    expect(s().balance).toBeNull();
  });

  it('signIn runs the popup and then checks', async () => {
    signInToIskam.mockResolvedValue(undefined);
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    await s().signIn();
    expect(s().status).toBe('balance');
    expect(s().signingIn).toBe(false);
  });

  it('a dismissed popup goes back to signed-out; a popup that never loaded to unavailable', async () => {
    signInToIskam.mockRejectedValueOnce(new LoginCancelledError());
    await s().signIn();
    expect(s().status).toBe('signed-out');
    signInToIskam.mockRejectedValueOnce(new LoginUnreachableError());
    await s().signIn();
    expect(s().status).toBe('unavailable');
  });

  it('a second tap while the popup is open does not open another', async () => {
    signInToIskam.mockReturnValue(new Promise(() => {}));
    void s().signIn();
    void s().signIn();
    await new Promise((r) => setTimeout(r, 0));
    expect(signInToIskam).toHaveBeenCalledTimes(1);
  });
});

describe('startTopUp', () => {
  const GATE = 'https://gate.gopay.com/gw-ui/rest/v3/1';
  const BALANCE = (n: string) =>
    `<div class="vyskaRiadkuKonto"><div>Hlavní konto</div><div>${n} Kč</div><a href="/Platby/NabitiKonta/0">Nabít</a></div>`;

  beforeEach(() => {
    runSilentChain.mockReset();
    signInToIskam.mockReset();
    initTopUp.mockReset();
    openGateway.mockReset();
    platformKind = 'capacitor';
    demo = false;
    s().reset();
  });

  it('opens the gateway, then re-reads the balance once the browser closes', async () => {
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('100') });
    await s().check();
    initTopUp.mockResolvedValue({ kind: 'ok', url: GATE });
    openGateway.mockResolvedValue(undefined);
    runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('350') });
    await s().startTopUp(250, 'gpay');
    expect(initTopUp).toHaveBeenCalledWith(expect.anything(), 250, 'gpay');
    expect(openGateway).toHaveBeenCalledWith(GATE);
    expect(s().balance?.amount).toBe(350);
    expect(s().topUp).toBe('idle');
  });

  it('re-checks once more after a short wait when the balance has not moved yet', async () => {
    vi.useFakeTimers();
    try {
      runSilentChain.mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('100') });
      await s().check();
      initTopUp.mockResolvedValue({ kind: 'ok', url: GATE });
      openGateway.mockResolvedValue(undefined);
      runSilentChain
        .mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('100') })
        .mockResolvedValueOnce({ state: 'live', kontaHtml: BALANCE('350') });
      const p = s().startTopUp(250, 'card');
      await vi.advanceTimersByTimeAsync(3000);
      await p;
      expect(s().balance?.amount).toBe(350);
      expect(runSilentChain).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('an expired session runs the chain, and the popup if the chain is dead, then inits again', async () => {
    initTopUp
      .mockResolvedValueOnce({ kind: 'expired' })
      .mockResolvedValueOnce({ kind: 'ok', url: GATE });
    runSilentChain
      .mockResolvedValueOnce({ state: 'dead' })
      .mockResolvedValue({ state: 'live', kontaHtml: BALANCE('1') });
    signInToIskam.mockResolvedValue(undefined);
    openGateway.mockResolvedValue(undefined);
    await s().startTopUp(10, 'card');
    expect(signInToIskam).toHaveBeenCalledTimes(1);
    expect(initTopUp).toHaveBeenCalledTimes(2);
    expect(openGateway).toHaveBeenCalledWith(GATE);
  });

  it('a rejected gateway URL opens nothing and shows the failure', async () => {
    initTopUp.mockResolvedValue({ kind: 'rejected' });
    await s().startTopUp(10, 'card');
    expect(openGateway).not.toHaveBeenCalled();
    expect(s().topUp).toBe('failed');
  });

  it('ignores a second startTopUp while the first is starting (double tap)', async () => {
    initTopUp.mockReturnValue(new Promise(() => {}));
    void s().startTopUp(10, 'card');
    void s().startTopUp(10, 'card');
    await new Promise((r) => setTimeout(r, 0));
    expect(initTopUp).toHaveBeenCalledTimes(1);
  });

  it('dismissing the popup mid top-up is not an error', async () => {
    initTopUp.mockResolvedValue({ kind: 'expired' });
    runSilentChain.mockResolvedValue({ state: 'dead' });
    signInToIskam.mockRejectedValue(new LoginCancelledError());
    await s().startTopUp(10, 'card');
    expect(s().topUp).toBe('idle');
    expect(openGateway).not.toHaveBeenCalled();
  });
});
