import { describe, it, expect, vi, beforeEach } from 'vitest';

/** A map stands in for IndexedDB, validating meta values like the real one. */
const { db } = vi.hoisted(() => ({ db: new Map<string, unknown>() }));
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => {
      const { MetaSchema } = await import('../../types/schemas/meta.schema');
      if (store !== 'meta' || MetaSchema.safeParse(v).success) db.set(`${store}/${key}`, v);
    }),
    delete: vi.fn(async (store: string, key: string) => db.delete(`${store}/${key}`)),
  },
}));

import { announceNovinky } from '../backgroundAnnounce';
import { NOVINKY_NOTIFIED_KEY } from '../novinkyRecord';
import { NEW_TERMS_META_KEY } from '../../services/sync/examTermsUnseen';
import { examTermKey } from '../../utils/newExamTerms';
import type { ExamSubject } from '../../types/exams';

const NOW = new Date(2026, 11, 1, 12, 0);

const vwa: ExamSubject = {
  version: 1,
  id: 'EBC-VWA',
  name: 'Vývoj webových aplikací',
  nameCs: 'Vývoj webových aplikací',
  code: 'EBC-VWA',
  sections: [
    {
      id: 'zk',
      name: 'zkouška',
      type: 'exam',
      status: 'open',
      terms: [{ id: '1', date: '14.12.2026', time: '11:00' }],
    },
  ],
};

const fresh = { exams: [vwa], boxes: [], subjects: {} };

/**
 * The Android background check announces what Novinky would show, in the same
 * words, from the same record as the foreground: each row once, whichever side
 * sees it first.
 */
describe('announceNovinky (Android background check)', () => {
  beforeEach(() => {
    db.clear();
    db.set(`meta/${NOVINKY_NOTIFIED_KEY}`, { alerts: [], feed: ['ev1'] });
  });

  it('posts a new exam date as Novinky words it, and records it', async () => {
    db.set(`meta/${NEW_TERMS_META_KEY}`, [examTermKey('EBC-VWA', '1')]);
    const notify = vi.fn();
    await announceNovinky(fresh, 'cz', notify, NOW);
    expect(notify).toHaveBeenCalledWith([
      {
        kind: 'exams',
        title: 'Nový termín: Vývoj webových aplikací',
        body: 'zkouška · 14. 12.',
        courseCode: 'EBC-VWA',
      },
    ]);
    const record = db.get(`meta/${NOVINKY_NOTIFIED_KEY}`) as { alerts: string[]; feed: string[] };
    expect(record.alerts.some((id) => id.startsWith('exam-new-'))).toBe(true);
    // The society part is the foreground's: untouched.
    expect(record.feed).toEqual(['ev1']);
  });

  it('posts nothing the record already holds: the foreground saw it first', async () => {
    db.set(`meta/${NEW_TERMS_META_KEY}`, [examTermKey('EBC-VWA', '1')]);
    await announceNovinky(fresh, 'cz', vi.fn(), NOW);
    const again = vi.fn();
    await announceNovinky(fresh, 'cz', again, NOW);
    expect(again).not.toHaveBeenCalled();
  });

  it('records silently on its first run, like the foreground', async () => {
    db.delete(`meta/${NOVINKY_NOTIFIED_KEY}`);
    db.set(`meta/${NEW_TERMS_META_KEY}`, [examTermKey('EBC-VWA', '1')]);
    const notify = vi.fn();
    await announceNovinky(fresh, 'cz', notify, NOW);
    expect(notify).not.toHaveBeenCalled();
    expect(db.get(`meta/${NOVINKY_NOTIFIED_KEY}`)).toMatchObject({ alerts: [expect.any(String)] });
  });

  // An empty read may be a half-failed one: the first record waits for exams,
  // or the terms it left out would arrive later as a backlog.
  it('does not take its first record from a run that read no exams', async () => {
    db.delete(`meta/${NOVINKY_NOTIFIED_KEY}`);
    await announceNovinky({ ...fresh, exams: [] }, 'cz', vi.fn(), NOW);
    expect(db.get(`meta/${NOVINKY_NOTIFIED_KEY}`)).toBeUndefined();
  });

  it('skips a row the student has already seen in Novinky', async () => {
    db.set(`meta/${NEW_TERMS_META_KEY}`, [examTermKey('EBC-VWA', '1')]);
    db.set('meta/seen_deadline_alerts', [`exam-new-${examTermKey('EBC-VWA', '1')}`]);
    const notify = vi.fn();
    await announceNovinky(fresh, 'cz', notify, NOW);
    expect(notify).not.toHaveBeenCalled();
  });
});
