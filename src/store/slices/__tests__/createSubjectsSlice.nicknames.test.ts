import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubjectsSlice } from '../createSubjectsSlice';

const db = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, value: unknown) => {
      db.set(`${store}/${key}`, value);
    }),
  },
}));

/**
 * A nickname is the student's own data and the phone has nowhere else to get
 * it from — nicknames do not sync between devices. It has to come back from
 * IndexedDB on the next launch, which is `fetchSubjects` at boot.
 */
describe('course nicknames survive a relaunch', () => {
  beforeEach(() => db.clear());

  const freshSlice = () => {
    const state: Record<string, unknown> = {};
    const set = vi.fn((patch) =>
      Object.assign(state, typeof patch === 'function' ? patch(state) : patch)
    );
    const slice = createSubjectsSlice(set as never, (() => state) as never, {} as never);
    Object.assign(state, slice);
    return state as unknown as ReturnType<typeof createSubjectsSlice>;
  };

  it('a nickname set in one session is there after the next boot', async () => {
    const before = freshSlice();
    before.setCourseNickname('EBC-ALG', '  Algo ');
    await Promise.resolve();

    const after = freshSlice();
    expect(after.courseNicknames).toEqual({});
    await after.fetchSubjects();
    expect(after.courseNicknames).toEqual({ 'EBC-ALG': 'Algo' });
  });

  it('a cleared nickname stays cleared', async () => {
    const before = freshSlice();
    before.setCourseNickname('EBC-ALG', 'Algo');
    before.setCourseNickname('EBC-ALG', null);
    await Promise.resolve();

    const after = freshSlice();
    await after.fetchSubjects();
    expect(after.courseNicknames).toEqual({});
  });
});
