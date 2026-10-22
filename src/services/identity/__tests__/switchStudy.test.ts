import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserParams = vi.fn();
const clearUserParamsCache = vi.fn();
const setPreferredStudium = vi.fn();
const executeAction = vi.fn();
const isInIframe = vi.fn();

vi.mock('../../../utils/userParams', () => ({
  getUserParams: () => getUserParams(),
  clearUserParamsCache: () => clearUserParamsCache(),
}));
vi.mock('../../../utils/userParams/studyPreference', () => ({
  setPreferredStudium: (...a: unknown[]) => setPreferredStudium(...a),
}));
vi.mock('../../../api/proxyClient', () => ({
  executeAction: (...a: unknown[]) => executeAction(...a),
  isInIframe: () => isInIframe(),
}));

const { switchStudy } = await import('../switchStudy');

const ON_A = { studentId: '900100', studium: '900001' };
const ON_B = { studentId: '900100', studium: '900002' };

describe('switchStudy', () => {
  beforeEach(() => {
    for (const f of [
      getUserParams,
      clearUserParamsCache,
      setPreferredStudium,
      executeAction,
      isInIframe,
    ])
      f.mockReset();
    isInIframe.mockReturnValue(true);
    executeAction.mockResolvedValue({ success: true });
  });

  // The extension has two contexts with their own databases and caches. The
  // host half moves first, so the iframe never reloads to the old study's data.
  it('stores the pick, moves the host page, then this context', async () => {
    const order: string[] = [];
    getUserParams.mockResolvedValueOnce(ON_A).mockImplementationOnce(async () => {
      order.push('reread');
      return ON_B;
    });
    setPreferredStudium.mockImplementation(async () => void order.push('pref'));
    executeAction.mockImplementation(async (a: string) => {
      order.push(a);
      return { success: true };
    });
    clearUserParamsCache.mockImplementation(() => void order.push('clearCache'));

    expect(await switchStudy(ON_B.studium)).toBe(true);
    expect(setPreferredStudium).toHaveBeenCalledWith('900100', ON_B.studium);
    expect(executeAction).toHaveBeenCalledWith('switch_study', { studium: ON_B.studium });
    expect(order).toEqual(['pref', 'switch_study', 'clearCache', 'reread']);
  });

  // Capacitor: one context, no host page to tell.
  it('does not message a host page outside the extension', async () => {
    isInIframe.mockReturnValue(false);
    getUserParams.mockResolvedValueOnce(ON_A).mockResolvedValueOnce(ON_B);
    expect(await switchStudy(ON_B.studium)).toBe(true);
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('does nothing when the study is already the current one', async () => {
    getUserParams.mockResolvedValue(ON_A);
    expect(await switchStudy(ON_A.studium)).toBe(true);
    expect(setPreferredStudium).not.toHaveBeenCalled();
  });

  it('reports failure when IS did not let the app move', async () => {
    getUserParams.mockResolvedValue(ON_A);
    expect(await switchStudy(ON_B.studium)).toBe(false);
  });

  // A refusal and a 30 s timeout look the same from here, and after a timeout
  // the host may still finish on the new study — so it is told to go back.
  it('restores the pick and sends the host page back when its request fails', async () => {
    getUserParams.mockResolvedValue(ON_A);
    executeAction.mockRejectedValueOnce(new Error('Timeout: switch_study'));
    await expect(switchStudy(ON_B.studium)).rejects.toThrow();
    expect(setPreferredStudium).toHaveBeenLastCalledWith('900100', ON_A.studium);
    expect(executeAction).toHaveBeenLastCalledWith('switch_study', { studium: ON_A.studium });
    expect(clearUserParamsCache).not.toHaveBeenCalled();
  });

  // Never two contexts on two studies.
  it('moves the host page back when this context could not follow it', async () => {
    getUserParams.mockResolvedValue(ON_A);
    expect(await switchStudy(ON_B.studium)).toBe(false);
    expect(setPreferredStudium).toHaveBeenLastCalledWith('900100', ON_A.studium);
    expect(executeAction).toHaveBeenLastCalledWith('switch_study', { studium: ON_A.studium });
  });

  it('reports failure without a signed-in student', async () => {
    getUserParams.mockResolvedValue(null);
    expect(await switchStudy(ON_B.studium)).toBe(false);
    expect(setPreferredStudium).not.toHaveBeenCalled();
  });
});
