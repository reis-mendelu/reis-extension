import { describe, it, expect, vi, beforeEach } from 'vitest';

const order: string[] = [];
let landsOn = '900002';
vi.mock('../syncService', () => ({ forgetStudyData: () => void order.push('forget') }));
vi.mock('../syncGate', () => ({
  whenSyncIdle: async () => void order.push('idle'),
  requestSync: async (reason: string) => void order.push(`sync:${reason}`),
}));
let reads = 0;
vi.mock('../../utils/userParams', () => ({
  clearUserParamsCache: () => void order.push('clearCache'),
  getUserParams: async () => {
    const first = reads++ === 0;
    order.push(first ? 'who' : 'reread');
    return { studentId: '900100', studium: first ? '900001' : landsOn };
  },
}));
vi.mock('../../utils/userParams/studyPreference', () => ({
  setPreferredStudium: async (id: string, s: string) => void order.push(`pref:${id}:${s}`),
}));

const { switchStudyOnHost } = await import('../switchStudyOnHost');

describe('switchStudyOnHost', () => {
  beforeEach(() => {
    order.length = 0;
    reads = 0;
    landsOn = '900002';
  });

  // The params re-read is what moves this context's record and drops its
  // host-origin cache; a cached record would answer it without asking. The
  // crawl of the new study waits out any crawl of the old one, which it would
  // otherwise join.
  it('stores the pick, re-reads the params, forgets the old study, then crawls', async () => {
    await switchStudyOnHost('900002');
    await vi.waitFor(() => expect(order).toContain('sync:user'));
    expect(order).toEqual([
      'who',
      'pref:900100:900002',
      'clearCache',
      'reread',
      'forget',
      'idle',
      'sync:user',
    ]);
  });

  // IS answered the default page but not the chosen study's: the record is
  // still the old study's, and reporting success would let the iframe move
  // alone.
  it('fails, forgets nothing and asks IS again next time when it did not move', async () => {
    landsOn = '900001';
    await expect(switchStudyOnHost('900002')).rejects.toThrow();
    expect(order).not.toContain('forget');
    expect(order).not.toContain('sync:user');
    expect(order.at(-1)).toBe('clearCache');
  });
});
