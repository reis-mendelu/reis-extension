import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndCacheSingleSyllabus } from '../syncSyllabus';
import { IndexedDBService } from '../../storage';
import { fetchSyllabus, findSubjectId, SYLLABUS_FETCH_FAILED } from '../../../api/syllabus';
import type { SyllabusRequirements } from '../../../types/documents';

vi.mock('../../storage', () => ({
  IndexedDBService: { set: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../api/syllabus', async (importOriginal) => {
  // importOriginal so SYLLABUS_FETCH_FAILED is the real sentinel rather than a
  // copy that could drift from the string the API actually returns.
  const actual = await importOriginal<typeof import('../../../api/syllabus')>();
  return { ...actual, fetchSyllabus: vi.fn(), findSubjectId: vi.fn() };
});

const ok = (lang: string): SyllabusRequirements =>
  ({
    version: 4,
    language: lang,
    requirementsText: `real ${lang}`,
    requirementsTable: [],
  }) as unknown as SyllabusRequirements;

const failed = (): SyllabusRequirements =>
  ({ requirementsText: SYLLABUS_FETCH_FAILED, requirementsTable: [] }) as SyllabusRequirements;

describe('fetchAndCacheSingleSyllabus', () => {
  beforeEach(() => vi.clearAllMocks());

  // One language, stored as a single-language record: the reader refetches a
  // record whose `language` does not match the UI, so a switch costs one
  // request on the next open instead of every open costing two.
  it('fetches, caches and returns only the language being read', async () => {
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockImplementation(async (_id, lang) => ok(lang ?? 'cz'));

    const res = await fetchAndCacheSingleSyllabus('EBC-PS', 'en', '12345');

    expect(res?.requirementsText).toBe('real en');
    expect(fetchSyllabus).toHaveBeenCalledTimes(1);
    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'en');
    expect(IndexedDBService.set).toHaveBeenCalledWith('syllabuses', 'EBC-PS', ok('en'));
  });

  // `fetchSyllabus` degrades gracefully by returning SYLLABUS_FETCH_FAILED as
  // the requirementsText rather than throwing, and its own doc says callers
  // that cache "can tell it apart from a real syllabus and avoid storing a
  // failure". The bulk sync honours that (injector/syncService.ts:408); this
  // on-demand path did not, so a failed fetch was persisted and then rendered
  // as the syllabus — a raw English string in a Czech UI, indistinguishable
  // from real content downstream.
  it('does not cache a failed fetch, and reports failure', async () => {
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue(failed());

    const res = await fetchAndCacheSingleSyllabus('EBC-PS', 'cz', '12345');

    expect(res).toBeUndefined();
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });

  it('returns undefined without fetching when no id can be resolved', async () => {
    vi.mocked(findSubjectId).mockResolvedValue(null);

    expect(await fetchAndCacheSingleSyllabus('EBC-PS', 'cz')).toBeUndefined();
    expect(fetchSyllabus).not.toHaveBeenCalled();
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });
});
