import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Odevzdavarna } from '../../../api/odevzdavarny';

/**
 * Each sync's box list is checked against the ids this device has already
 * seen. A map stands in for IndexedDB.
 */
const { db } = vi.hoisted(() => ({ db: new Map<string, unknown>() }));
type Write = { store: string; key: string; value: unknown };
vi.mock('../../storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => db.set(`${store}/${key}`, v)),
    setAcross: vi.fn(async (writes: Write[]) => {
      for (const w of writes) db.set(`${w.store}/${w.key}`, w.value);
    }),
  },
}));

import {
  persistNewBoxes,
  clearNewBoxes,
  KNOWN_BOXES_META_KEY,
  NEW_BOXES_META_KEY,
} from '../newSubmissionBoxes';

const NOW = new Date(2026, 9, 29, 12, 0).getTime();

const box = (id: string): Odevzdavarna => ({
  courseId: '164074',
  courseNameCs: 'Matematika',
  courseNameEn: 'Mathematics',
  name: `Box ${id}`,
  type: '',
  deadline: '20.12.2026 23:59',
  odevzdavarnaId: id,
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
  section: 'open',
  isOpen: true,
});

describe('persistNewBoxes', () => {
  beforeEach(() => {
    db.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('first sight after install: remembers every box, announces none', async () => {
    const out = await persistNewBoxes([box('1'), box('2')]);
    expect(out).toEqual({ found: [], unseen: [] });
    expect(db.get(`meta/${KNOWN_BOXES_META_KEY}`)).toEqual(['1', '2']);
  });

  // "Key absent" is the baseline signal, so a student with no boxes yet must
  // still leave one behind: their first real box is news, not the baseline.
  it('first sight of an empty list is still recorded', async () => {
    await persistNewBoxes([]);
    expect(db.get(`meta/${KNOWN_BOXES_META_KEY}`)).toEqual([]);
    const out = await persistNewBoxes([box('1')]);
    expect(out.found).toEqual(['1']);
  });

  it('a box that was not there at the previous sync is found and kept unseen', async () => {
    await persistNewBoxes([box('1')]);
    const out = await persistNewBoxes([box('1'), box('2')]);
    expect(out).toEqual({ found: ['2'], unseen: ['2'] });
    expect(db.get(`meta/${NEW_BOXES_META_KEY}`)).toEqual(['2']);
  });

  it('the next sync finds nothing more, and the unseen box stays', async () => {
    await persistNewBoxes([box('1')]);
    await persistNewBoxes([box('1'), box('2')]);
    const out = await persistNewBoxes([box('1'), box('2')]);
    expect(out).toEqual({ found: [], unseen: ['2'] });
  });

  // A stale or partial list can miss a box for one push; it is not new again.
  it('a box that drops out of one list and comes back is not announced twice', async () => {
    await persistNewBoxes([box('1')]);
    await persistNewBoxes([]);
    const out = await persistNewBoxes([box('1')]);
    expect(out.found).toEqual([]);
  });

  it('an unseen box that left IS is forgotten', async () => {
    await persistNewBoxes([box('1')]);
    await persistNewBoxes([box('1'), box('2')]);
    const out = await persistNewBoxes([box('1')]);
    expect(out.unseen).toEqual([]);
  });
});

describe('clearNewBoxes', () => {
  beforeEach(() => db.clear());

  it('drops only the given boxes', async () => {
    db.set(`meta/${NEW_BOXES_META_KEY}`, ['2', '3']);
    expect(await clearNewBoxes(['2'])).toEqual(['3']);
    expect(db.get(`meta/${NEW_BOXES_META_KEY}`)).toEqual(['3']);
  });
});
