import { describe, it, expect, vi, beforeEach } from 'vitest';

/** A map stands in for IndexedDB, as in newExamTerms.test.ts. */
const { db } = vi.hoisted(() => ({ db: new Map<string, unknown>() }));
vi.mock('../../storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => db.set(`${store}/${key}`, v)),
    delete: vi.fn(async (store: string, key: string) => db.delete(`${store}/${key}`)),
  },
}));

import {
  addUnseenTerms,
  clearUnseenTerms,
  readUnseenTerms,
  resetUnseenTerms,
  NEW_TERMS_META_KEY,
} from '../examTermsUnseen';

describe('the unseen new exam terms', () => {
  beforeEach(() => db.clear());

  it('keeps every new term until Zkoušky is opened', async () => {
    expect(await addUnseenTerms(['a'])).toEqual(['a']);
    expect(await addUnseenTerms(['b', 'a'])).toEqual(['a', 'b']);
    expect(await readUnseenTerms()).toEqual(['a', 'b']);
    expect(await clearUnseenTerms(['a', 'b'])).toEqual([]);
    expect(await readUnseenTerms()).toEqual([]);
  });

  // Two extension tabs share IndexedDB but not their store: a date another tab
  // found, and this one never showed, must survive this tab's Zkoušky.
  it('clears only the terms that were on screen', async () => {
    await addUnseenTerms(['a']);
    await addUnseenTerms(['b']); // found by another tab
    expect(await clearUnseenTerms(['a'])).toEqual(['b']);
    expect(await readUnseenTerms()).toEqual(['b']);
  });

  it('a sync that finds nothing new leaves the list as it was', async () => {
    await addUnseenTerms(['a']);
    expect(await addUnseenTerms([])).toEqual(['a']);
  });

  it('forgets everything for another study', async () => {
    await addUnseenTerms(['a']);
    await resetUnseenTerms();
    expect(db.has(`meta/${NEW_TERMS_META_KEY}`)).toBe(false);
  });
});
