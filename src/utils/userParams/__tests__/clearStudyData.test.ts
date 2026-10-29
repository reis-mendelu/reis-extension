import { describe, it, expect, vi } from 'vitest';

const { clear, del, getAllWithKeys } = vi.hoisted(() => ({
  clear: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  getAllWithKeys: vi.fn(async () => [
    { key: 'past_semester_812', value: {} },
    { key: 'reis_theme', value: 'mendelu' },
  ]),
}));
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { clear, delete: del, getAllWithKeys },
}));

import { clearStudyData } from '../clearStudyData';

describe('clearStudyData', () => {
  // Review #591: the left study's unread "Nové body" came back after a restart,
  // because fetchZaznamnik restores them from this key.
  it("drops the left study's unread Nové body with its other meta", async () => {
    await clearStudyData();
    const deleted = del.mock.calls.map((c) => (c as unknown[])[1]);
    expect(deleted).toEqual(
      expect.arrayContaining(['zaznamnik_new_points', 'study_stats', 'past_semester_812'])
    );
    expect(deleted).not.toContain('reis_theme');
    expect(clear).toHaveBeenCalledWith('zaznamnik');
  });

  // The next study's first sync has to be a baseline, not a list of "new" boxes.
  it("forgets the left study's submission boxes, seen and new", async () => {
    await clearStudyData();
    const deleted = del.mock.calls.map((c) => (c as unknown[])[1]);
    expect(deleted).toEqual(expect.arrayContaining(['odevzdavarny_known', 'odevzdavarny_new']));
  });
});
