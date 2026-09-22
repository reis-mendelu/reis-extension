import { describe, it, expect, vi, beforeEach } from 'vitest';

let announce: ((p: unknown) => void) | null = null;
const getUserParams = vi.fn(async () => null);
const clearUserParamsCache = vi.fn();
let confirmed = true;

vi.mock('../../../utils/userParams', () => ({
  getUserParams: () => getUserParams(),
  isIdentityConfirmed: () => confirmed,
  clearUserParamsCache: () => clearUserParamsCache(),
}));
vi.mock('../../../utils/userParams/identityEvents', () => ({
  onIdentityChange: (cb: (p: unknown) => void) => {
    announce = cb;
    return () => {
      announce = null;
    };
  },
}));

const { watchSignedInStudent } = await import('../watchSignedInStudent');

describe('watchSignedInStudent', () => {
  beforeEach(() => {
    announce = null;
    confirmed = true;
    getUserParams.mockClear();
    clearUserParamsCache.mockClear();
  });

  /**
   * The check lives in `getUserParams()`, which means it only runs if
   * something asks. On a boot where nothing happened to read the params, a
   * switched student would go unnoticed — so the boot asks, once, on purpose.
   */
  it('asks who is signed in rather than waiting to be asked', () => {
    watchSignedInStudent(vi.fn());
    expect(getUserParams).toHaveBeenCalledTimes(1);
  });

  /**
   * And keeps asking until IS answers. In the iframe this call and the
   * daily-usage ping are the only reads of the params at boot, so a first
   * attempt lost to a slow IS or a cold fetch proxy would leave the previous
   * student on screen with nothing left to trigger the re-check.
   *
   * The cache has to be dropped between attempts or the retry asks nothing:
   * `getUserParams` serves what it is holding.
   */
  it('retries until IS confirms who is signed in', async () => {
    confirmed = false;
    getUserParams.mockImplementation(async () => {
      if (getUserParams.mock.calls.length >= 2) confirmed = true;
      return null;
    });

    watchSignedInStudent(vi.fn(), { attempts: 3, gapMs: 0 });
    await vi.waitFor(() => expect(getUserParams).toHaveBeenCalledTimes(2));
    expect(clearUserParamsCache).toHaveBeenCalledTimes(1);

    // Confirmed on the second attempt — it stops there.
    await new Promise((r) => setTimeout(r, 10));
    expect(getUserParams).toHaveBeenCalledTimes(2);
  });

  // A confirmed first answer asks once and never again — the common case, and
  // the one that must not cost three requests.
  it('asks exactly once when the first answer confirms', async () => {
    watchSignedInStudent(vi.fn(), { attempts: 3, gapMs: 0 });
    await new Promise((r) => setTimeout(r, 10));
    expect(getUserParams).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than retrying forever', async () => {
    confirmed = false;
    watchSignedInStudent(vi.fn(), { attempts: 2, gapMs: 0 });
    await new Promise((r) => setTimeout(r, 20));
    expect(getUserParams).toHaveBeenCalledTimes(2);
  });

  /**
   * An IDB wipe does not reach the Zustand store: it is already holding the
   * previous student's schedule, exams and subjects in memory, and the screens
   * read from it synchronously. Re-running boot is what clears that — the same
   * reasoning `mobile/signOut.ts` restarts on, rather than hand-rolling a
   * teardown for forty slices.
   */
  it('restarts the app when IS turns out to have someone else signed in', () => {
    const restart = vi.fn();
    watchSignedInStudent(restart);
    announce?.({ studentId: '987654' });
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('stops listening once the app tears the watch down', () => {
    const restart = vi.fn();
    const off = watchSignedInStudent(restart);
    off();
    expect(announce).toBeNull();
  });
});
