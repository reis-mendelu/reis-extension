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
    delete: vi.fn(async (store: string, key: string) => db.delete(`${store}/${key}`)),
    setAcross: vi.fn(async (writes: Write[]) => {
      for (const w of writes) db.set(`${w.store}/${w.key}`, w.value);
    }),
  },
}));

import {
  persistNewBoxes,
  clearNewBoxes,
  readNewBoxes,
  resetNewBoxes,
  KNOWN_BOXES_META_KEY,
  NEW_BOXES_META_KEY,
} from '../newSubmissionBoxes';

const NOW = new Date(2026, 9, 29, 12, 0).getTime();

const box = (id: string, obdobi = 'P1'): Odevzdavarna => ({
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
  obdobi,
});

// The sync reads the current period; boxes carry their own.
const persist = (boxes: Odevzdavarna[], obdobi = 'P1') => persistNewBoxes(boxes, obdobi);

describe('persistNewBoxes', () => {
  beforeEach(() => {
    db.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('first sight after install: remembers every box, announces none', async () => {
    const out = await persist([box('1'), box('2')]);
    expect(out).toEqual({ found: [], unseen: [] });
    expect(db.get(`meta/${KNOWN_BOXES_META_KEY}`)).toEqual({ ids: ['1', '2'], periods: ['P1'] });
  });

  // "Key absent" is the baseline signal, so a student with no boxes yet must
  // still leave one behind: their first real box is news, not the baseline.
  it('first sight of an empty list is still recorded', async () => {
    await persist([]);
    expect(db.get(`meta/${KNOWN_BOXES_META_KEY}`)).toEqual({ ids: [], periods: ['P1'] });
    const out = await persist([box('1')]);
    expect(out.found).toEqual(['1']);
  });

  it('a box that was not there at the previous sync is found and kept unseen', async () => {
    await persist([box('1')]);
    const out = await persist([box('1'), box('2')]);
    expect(out).toEqual({ found: ['2'], unseen: ['2'] });
    expect(db.get(`meta/${NEW_BOXES_META_KEY}`)).toEqual(['2']);
  });

  it('the next sync finds nothing more, and the unseen box stays', async () => {
    await persist([box('1')]);
    await persist([box('1'), box('2')]);
    const out = await persist([box('1'), box('2')]);
    expect(out).toEqual({ found: [], unseen: ['2'] });
  });

  // A stale or partial list can miss a box for one push; it is not new again.
  it('a box that drops out of one list and comes back is not announced twice', async () => {
    await persist([box('1')]);
    await persist([]);
    const out = await persist([box('1')]);
    expect(out.found).toEqual([]);
  });

  // The semester turned: the new period's boxes have been in IS for weeks.
  it('the first read of a new period announces none of its boxes', async () => {
    await persist([box('1')]);
    const out = await persist([box('2', 'P2'), box('1')], 'P2');
    expect(out.found).toEqual([]);
    const next = await persist([box('2', 'P2'), box('3', 'P2'), box('1')], 'P2');
    expect(next.found).toEqual(['3']);
  });

  // A semester that starts with no boxes is still read; its first box is news.
  it('a new period read empty makes its first box news', async () => {
    await persist([box('1')]);
    await persist([box('1')], 'P2');
    const out = await persist([box('2', 'P2'), box('1')], 'P2');
    expect(out.found).toEqual(['2']);
  });

  // A push can lack a period's rows (a failed read right after the semester
  // turned): the box stays unseen, and simply has no row while it is absent.
  it('an unseen box missing from one push stays unseen', async () => {
    await persist([box('1')]);
    await persist([box('1'), box('2')]);
    const out = await persist([box('1')]);
    expect(out.unseen).toEqual(['2']);
  });

  // If IS lists a box before it takes files, its opening is the news.
  it('a box seen while it will not take files yet is announced when it opens', async () => {
    const waiting = { ...box('2'), section: 'closed' as const, isOpen: false };
    await persist([box('1'), waiting]);
    expect(db.get(`meta/${KNOWN_BOXES_META_KEY}`)).toEqual({ ids: ['1'], periods: ['P1'] });
    const out = await persist([box('1'), box('2')]);
    expect(out.found).toEqual(['2']);
  });

  it('a closed box whose deadline passed is known, and never announced', async () => {
    const past = {
      ...box('2'),
      section: 'closed' as const,
      isOpen: false,
      deadline: '01.10.2026 10:00',
    };
    await persist([box('1')]);
    const out = await persist([box('1'), past]);
    expect(out.found).toEqual([]);
    expect((db.get(`meta/${KNOWN_BOXES_META_KEY}`) as { ids: string[] }).ids).toContain('2');
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

describe('reading and resetting', () => {
  beforeEach(() => db.clear());

  it('reads what is still unseen', async () => {
    db.set(`meta/${NEW_BOXES_META_KEY}`, ['2']);
    expect(await readNewBoxes()).toEqual(['2']);
  });

  it('another study forgets every box, so its first sync is a baseline again', async () => {
    await persist([box('1')]);
    await persist([box('1'), box('2')]);
    await resetNewBoxes();
    expect(db.has(`meta/${KNOWN_BOXES_META_KEY}`)).toBe(false);
    expect(db.has(`meta/${NEW_BOXES_META_KEY}`)).toBe(false);
    expect((await persist([box('7')])).found).toEqual([]);
  });
});
