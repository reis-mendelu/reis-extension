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
const fetchClaims = vi.fn();
const openClaimInIskam = vi.fn();
vi.mock('../iskamClaims', () => ({ fetchClaims: (...a: unknown[]) => fetchClaims(...a) }));
vi.mock('../iskamPayClaim', () => ({
  openClaimInIskam: (...a: unknown[]) => openClaimInIskam(...a),
}));
vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: platformKind }) }));
vi.mock('../../../errors/demoMode', () => ({ isDemoMode: () => demo }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { useIskamStore } from '../iskamStore';

const KONTA = `<div class="vyskaRiadkuKonto"><div>Hlavní konto</div><div>245,00 Kč</div><a href="/Platby/NabitiKonta/0">Nabít</a></div>`;
const s = () => useIskamStore.getState();

const CLAIM = {
  id: '00000000-0000-0000-0000-000000000001',
  due: '2026-11-20',
  description: 'Ubytování 31.10.2026 - 30.11.2026',
  remaining: 4815,
};

describe('useIskamStore claims', () => {
  beforeEach(() => {
    runSilentChain.mockReset();
    fetchClaims.mockReset();
    openClaimInIskam.mockReset();
    platformKind = 'capacitor';
    demo = false;
    s().reset();
  });

  it('reads the claims after a live balance, in the same check', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValue([CLAIM]);
    await s().check();
    expect(s().balance).toEqual({ amount: 245 });
    expect(s().claims).toEqual([CLAIM]);
  });

  it('shows no claims without a balance, and reads no second time', async () => {
    runSilentChain.mockResolvedValue({ state: 'dead' });
    fetchClaims.mockResolvedValue([CLAIM]);
    await s().check();
    expect(fetchClaims).toHaveBeenCalledTimes(1);
    expect(fetchClaims).toHaveBeenCalledWith(expect.anything(), { persist: false });
    expect(s().claims).toBeNull();
  });

  it('a failed claims read leaves the balance and shows no claim', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockRejectedValue(new Error('boom'));
    await s().check();
    expect(s().status).toBe('balance');
    expect(s().claims).toBeNull();
  });

  it('Zaplatit opens WebISKAM, then reads balance and claims again', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValueOnce([CLAIM]).mockResolvedValueOnce([]);
    await s().check();
    let finish!: () => void;
    openClaimInIskam.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const p = s().payClaim(CLAIM.id);
    expect(s().payingClaim).toBe(true);
    // A second tap while WebISKAM is open does nothing.
    await s().payClaim(CLAIM.id);
    expect(openClaimInIskam).toHaveBeenCalledOnce();
    finish();
    await p;
    expect(openClaimInIskam).toHaveBeenCalledWith(CLAIM.id);
    expect(s().payingClaim).toBe(false);
    expect(s().claims).toEqual([]);
    // The balance was read again too: once before Zaplatit, once after.
    expect(runSilentChain).toHaveBeenCalledTimes(2);
  });

  it('sign-out clears the claims', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValue([CLAIM]);
    await s().check();
    s().signOut();
    expect(s().claims).toBeNull();
  });

  it('reads the claims alongside the chain, without saving the jar', async () => {
    let chainDone!: (v: unknown) => void;
    runSilentChain.mockReturnValue(new Promise((r) => (chainDone = r)));
    fetchClaims.mockResolvedValue([CLAIM]);
    const p = s().check();
    // Started while the chain is still pending (no tick counting: any new await
    // in check() would break that without a real regression).
    await vi.waitFor(() =>
      expect(fetchClaims).toHaveBeenCalledWith(expect.anything(), { persist: false })
    );
    chainDone({ state: 'live', kontaHtml: KONTA });
    await p;
    expect(fetchClaims).toHaveBeenCalledOnce();
    expect(s().claims).toEqual([CLAIM]);
  });

  it('reads once more, saving, when the early read met an expired login', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValueOnce('expired').mockResolvedValueOnce([CLAIM]);
    await s().check();
    expect(fetchClaims).toHaveBeenLastCalledWith(expect.anything(), { persist: true });
    expect(s().claims).toEqual([CLAIM]);
  });

  it('keeps the skeleton until the claims are read, then shows both at once', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    let claimsDone!: (v: unknown) => void;
    fetchClaims.mockReturnValue(new Promise((r) => (claimsDone = r)));
    const p = s().check();
    await vi.waitFor(() => expect(runSilentChain).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(s().status).toBe('checking');
    expect(s().balance).toBeNull();
    claimsDone([CLAIM]);
    await p;
    expect(s().status).toBe('balance');
    expect(s().balance).toEqual({ amount: 245 });
    expect(s().claims).toEqual([CLAIM]);
  });

  it('says paid only when the re-read no longer lists the claim', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValueOnce([CLAIM]).mockResolvedValueOnce([]);
    await s().check();
    openClaimInIskam.mockResolvedValue(undefined);
    await s().payClaim(CLAIM.id);
    expect(s().lastClaimPaid).toEqual({ amount: CLAIM.remaining });
  });

  it('closing WebISKAM without paying says nothing', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValue([CLAIM]);
    await s().check();
    openClaimInIskam.mockResolvedValue(undefined);
    await s().payClaim(CLAIM.id);
    expect(s().lastClaimPaid).toBeNull();
  });

  it('a failed re-read is not taken for a payment', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValueOnce([CLAIM]).mockResolvedValueOnce(null);
    await s().check();
    openClaimInIskam.mockResolvedValue(undefined);
    await s().payClaim(CLAIM.id);
    expect(s().lastClaimPaid).toBeNull();
  });

  it('closing the sheet while WebISKAM is open keeps Zaplatit disabled until it closes', async () => {
    runSilentChain.mockResolvedValue({ state: 'live', kontaHtml: KONTA });
    fetchClaims.mockResolvedValue([CLAIM]);
    await s().check();
    let finish!: () => void;
    openClaimInIskam.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const p = s().payClaim(CLAIM.id);
    s().reset();
    expect(s().payingClaim).toBe(true);
    await s().payClaim(CLAIM.id);
    expect(openClaimInIskam).toHaveBeenCalledOnce();
    finish();
    await p;
    expect(s().payingClaim).toBe(false);
  });
});
