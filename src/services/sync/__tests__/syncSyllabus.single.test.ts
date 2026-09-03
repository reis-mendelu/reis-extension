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

  it('caches and returns the requested language when both fetches succeed', async () => {
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockImplementation(async (_id, lang) => ok(lang ?? 'cz'));

    const res = await fetchAndCacheSingleSyllabus('EBC-PS', 'en', '12345');

    expect(res?.requirementsText).toBe('real en');
    expect(IndexedDBService.set).toHaveBeenCalledWith('syllabuses', 'EBC-PS', {
      cz: ok('cz'),
      en: ok('en'),
    });
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

  // A partial write would break the record's shape: the reader branches on
  // `'cz' in data && 'en' in data`, so a half-record falls through to the
  // single-syllabus branch and the whole `{cz: ...}` wrapper gets treated as a
  // syllabus. Store both or neither.
  it('does not write a partial record when only one language fails', async () => {
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockImplementation(async (_id, lang) =>
      lang === 'en' ? failed() : ok('cz')
    );

    const res = await fetchAndCacheSingleSyllabus('EBC-PS', 'cz', '12345');

    expect(IndexedDBService.set).not.toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  it('returns undefined without fetching when no id can be resolved', async () => {
    vi.mocked(findSubjectId).mockResolvedValue(null);

    expect(await fetchAndCacheSingleSyllabus('EBC-PS', 'cz')).toBeUndefined();
    expect(fetchSyllabus).not.toHaveBeenCalled();
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });
});
