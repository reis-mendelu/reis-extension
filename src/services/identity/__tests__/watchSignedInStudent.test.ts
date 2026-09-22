import { describe, it, expect, vi, beforeEach } from 'vitest';

let announce: ((p: unknown) => void) | null = null;
const getUserParams = vi.fn(async () => null);

vi.mock('../../../utils/userParams', () => ({
  getUserParams: () => getUserParams(),
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
    getUserParams.mockClear();
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
