import { describe, it, expect, vi, beforeEach } from 'vitest';

const { calls, getUserParams, selectStudy, executeAction } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    getUserParams: vi.fn(),
    selectStudy: vi.fn(async () => void calls.push('selectStudy')),
    executeAction: vi.fn(async (a: string) => void calls.push(a)),
  };
});
vi.mock('../../../utils/userParams', () => ({
  getUserParams,
  selectStudy,
  isIdentityConfirmed: () => true,
}));
vi.mock('../../../api/proxyClient', () => ({ executeAction }));

import { useAppStore } from '../../useAppStore';

const AII = { studium: '900011', obdobi: '829', label: 'PEF B-AII prez', isErasmus: false };
const EM = { studium: '900012', obdobi: '829', label: 'PEF B-EM komb', isErasmus: false };
const params = (s: typeof AII) => ({
  studium: s.studium,
  obdobi: s.obdobi,
  studentId: '100001',
  facultyLabel: 'PEF',
  studyProgram: s === EM ? 'B-EM' : 'B-AII',
  isErasmus: false,
  studies: [AII, EM],
});

describe('switchStudy', () => {
  beforeEach(async () => {
    calls.length = 0;
    for (const m of [getUserParams, selectStudy, executeAction]) m.mockClear();
    useAppStore.setState({ demoMode: false, studySwitching: false, impersonation: null });
    getUserParams.mockResolvedValue(params(AII));
    await useAppStore.getState().loadContext();
  });

  it('loads the active studies into the store', () => {
    expect(useAppStore.getState().studies.map((s) => s.studium)).toEqual(['900011', '900012']);
    expect(useAppStore.getState().studiumId).toBe('900011');
  });

  /**
   * In the extension the crawling context (the content script) keeps its own
   * user params. It is switched FIRST: switching only this context and then
   * failing to reach the other would show study B while study A was synced.
   */
  it('switches the crawling context first, then this one, then reloads the context', async () => {
    getUserParams.mockResolvedValue(params(EM));
    expect(await useAppStore.getState().switchStudy('900012')).toBe(true);
    expect(calls).toEqual(['select_study', 'selectStudy']);
    expect(executeAction).toHaveBeenCalledWith('select_study', { studium: '900012' });
    expect(useAppStore.getState()).toMatchObject({
      studiumId: '900012',
      userProgramme: 'B-EM',
      studentId: '100001',
      studySwitching: false,
    });
  });

  it('leaves this context alone when the crawling one refuses, and undoes a late switch', async () => {
    executeAction.mockRejectedValueOnce(new Error('timeout'));
    expect(await useAppStore.getState().switchStudy('900012')).toBe(false);
    expect(selectStudy).not.toHaveBeenCalled();
    expect(executeAction).toHaveBeenLastCalledWith('select_study', { studium: '900011' });
    expect(useAppStore.getState().studiumId).toBe('900011');
    expect(useAppStore.getState().studySwitching).toBe(false);
  });

  it('puts the crawling context back when this one cannot follow', async () => {
    selectStudy.mockRejectedValueOnce(new Error('idb'));
    expect(await useAppStore.getState().switchStudy('900012')).toBe(false);
    expect(executeAction.mock.calls).toEqual([
      ['select_study', { studium: '900012' }],
      ['select_study', { studium: '900011' }],
    ]);
    expect(useAppStore.getState().studiumId).toBe('900011');
  });

  it('refuses while an admin is impersonating a student', async () => {
    useAppStore.setState({ impersonation: {} as never });
    expect(await useAppStore.getState().switchStudy('900012')).toBe(false);
    expect(executeAction).not.toHaveBeenCalled();
    useAppStore.setState({ impersonation: null });
  });

  it('does nothing for the study already in use, or in demo mode', async () => {
    expect(await useAppStore.getState().switchStudy('900011')).toBe(true);
    useAppStore.setState({ demoMode: true });
    expect(await useAppStore.getState().switchStudy('900012')).toBe(false);
    expect(executeAction).not.toHaveBeenCalled();
  });
});
