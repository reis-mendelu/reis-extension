import { describe, it, expect, beforeEach } from 'vitest';
import { TTL, isFresh, markFetched, resetSyncTtl, ttlGated } from '../syncTtl';

describe('syncTtl', () => {
  beforeEach(() => resetSyncTtl());

  describe('isFresh', () => {
    it('is false for a key never fetched', () => {
      expect(isFresh('subjects', TTL.SEMESTER)).toBe(false);
    });

    it('is true inside the window and false past it', () => {
      markFetched('subjects', 1_000);
      expect(isFresh('subjects', 10_000, 5_000)).toBe(true);
      expect(isFresh('subjects', 10_000, 11_001)).toBe(false);
    });

    it('is never true for the hot tier, however recently it ran', () => {
      markFetched('exams', 1_000);
      expect(isFresh('exams', TTL.HOT, 1_000)).toBe(false);
    });
  });

  describe('ttlGated', () => {
    it('fetches and marks on the first run', async () => {
      let calls = 0;
      const value = await ttlGated('studyPlan', TTL.SEMESTER, false, async () => {
        calls++;
        return { plan: true };
      });
      expect(calls).toBe(1);
      expect(value).toEqual({ plan: true });
      expect(isFresh('studyPlan', TTL.SEMESTER)).toBe(true);
    });

    it('skips and returns null when the value is cached and still fresh', async () => {
      markFetched('studyPlan');
      let calls = 0;
      const value = await ttlGated('studyPlan', TTL.SEMESTER, true, async () => {
        calls++;
        return { plan: true };
      });
      expect(calls).toBe(0);
      expect(value).toBeNull();
    });

    // The load-bearing guarantee: the TTL map is in memory, so a fresh content
    // script starts empty. A skip may never leave a surface with no data.
    it('fetches when this context holds no cached value, however fresh the stamp', async () => {
      markFetched('studyPlan');
      let calls = 0;
      await ttlGated('studyPlan', TTL.SEMESTER, false, async () => {
        calls++;
        return { plan: true };
      });
      expect(calls).toBe(1);
    });

    it('fetches again once the TTL has expired', async () => {
      markFetched('files:MT101', Date.now() - (TTL.FILES + 1));
      let calls = 0;
      await ttlGated('files:MT101', TTL.FILES, true, async () => {
        calls++;
        return [{ file: 1 }];
      });
      expect(calls).toBe(1);
    });

    it('never skips a hot-tier resource', async () => {
      let calls = 0;
      for (let i = 0; i < 3; i++) {
        await ttlGated('exams', TTL.HOT, true, async () => {
          calls++;
          return [{ code: 'MT101' }];
        });
      }
      expect(calls).toBe(3);
    });

    // A fetch we would not store must not count as done, or one failed run
    // would blank the resource for a whole TTL window.
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty array', []],
    ])('does not mark the resource fetched when the fetch yields %s', async (_label, result) => {
      await ttlGated('exams', TTL.SEMESTER, false, async () => result);
      expect(isFresh('exams', TTL.SEMESTER)).toBe(false);
    });

    it('propagates a rejection without marking the resource fetched', async () => {
      await expect(
        ttlGated('subjects', TTL.SEMESTER, false, async () => {
          throw new Error('IS down');
        })
      ).rejects.toThrow('IS down');
      expect(isFresh('subjects', TTL.SEMESTER)).toBe(false);
    });
  });

  it('resetSyncTtl makes every resource due again — the explicit-refresh path', async () => {
    markFetched('subjects');
    markFetched('studyPlan');
    resetSyncTtl();
    expect(isFresh('subjects', TTL.SEMESTER)).toBe(false);
    expect(isFresh('studyPlan', TTL.SEMESTER)).toBe(false);
  });
});
