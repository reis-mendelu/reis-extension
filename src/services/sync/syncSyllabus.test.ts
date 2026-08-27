/**
 * fetchAndCacheSingleSyllabus had no test of its own. It was reached only
 * incidentally, by an unawaited async path in another suite, so whether its lines
 * counted depended on how far that path got before the run ended -- which made
 * the coverage number for this whole directory move between runs and left the
 * ratchet passing at its exact integer minimum. Testing it directly is what makes
 * the measurement deterministic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());
const fetchSyllabus = vi.hoisted(() => vi.fn());
const findSubjectId = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('../storage', () => ({ IndexedDBService: { get, set } }));
vi.mock('../../api/syllabus', () => ({ fetchSyllabus, findSubjectId }));
vi.mock('../../utils/reportError', () => ({ logError }));

import { syncSyllabus, fetchAndCacheSingleSyllabus } from './syncSyllabus';

const CZ = { requirements: 'cz-text' };
const EN = { requirements: 'en-text' };

beforeEach(() => {
  vi.clearAllMocks();
  fetchSyllabus.mockImplementation(async (_id: string, lang: string) => (lang === 'en' ? EN : CZ));
  set.mockResolvedValue(undefined);
});

describe('syncSyllabus', () => {
  it('does nothing when no subjects are cached', async () => {
    get.mockResolvedValue(null);
    await syncSyllabus();
    expect(fetchSyllabus).not.toHaveBeenCalled();
  });

  it('does nothing when the cached record has no data', async () => {
    get.mockResolvedValue({});
    await syncSyllabus();
    expect(fetchSyllabus).not.toHaveBeenCalled();
  });

  it('stores both languages under the course code', async () => {
    get.mockResolvedValue({ data: { 'EBC-OS': { subjectId: '4210' } } });

    await syncSyllabus();

    expect(set).toHaveBeenCalledWith('syllabuses', 'EBC-OS', { cz: CZ, en: EN });
  });

  it('skips a subject with no subjectId', async () => {
    get.mockResolvedValue({ data: { 'EBC-OS': {} } });

    await syncSyllabus();

    expect(fetchSyllabus).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('keeps going after one subject fails, and reports it', async () => {
    // Same contract as syncFiles: one bad subject must not cost the student the
    // syllabus of every subject after it.
    get.mockResolvedValue({
      data: { BROKEN: { subjectId: '1' }, FINE: { subjectId: '2' } },
    });
    fetchSyllabus.mockImplementation(async (id: string) => {
      if (id === '1') throw new Error('IS 500');
      return CZ;
    });

    await syncSyllabus();

    expect(set).toHaveBeenCalledWith('syllabuses', 'FINE', expect.anything());
    expect(logError).toHaveBeenCalledWith('Sync.syncSyllabus', expect.any(Error), {
      courseCode: 'BROKEN',
    });
  });
});

describe('fetchAndCacheSingleSyllabus', () => {
  it('uses the course id it was given without looking one up', async () => {
    const out = await fetchAndCacheSingleSyllabus('EBC-OS', 'cz', '4210');

    expect(findSubjectId).not.toHaveBeenCalled();
    expect(out).toBe(CZ);
    expect(set).toHaveBeenCalledWith('syllabuses', 'EBC-OS', { cz: CZ, en: EN });
  });

  it('looks the id up when none was supplied', async () => {
    findSubjectId.mockResolvedValue('9999');

    const out = await fetchAndCacheSingleSyllabus('EBC-OS', 'cz', undefined, 'Operating Systems');

    expect(findSubjectId).toHaveBeenCalledWith('EBC-OS', 'Operating Systems');
    expect(fetchSyllabus).toHaveBeenCalledWith('9999', 'cz');
    expect(out).toBe(CZ);
  });

  it('returns the English syllabus when English was asked for', async () => {
    // Both languages are always fetched and cached; only the RETURNED one
    // depends on the argument. Returning the wrong one shows the student a
    // syllabus in the language they did not pick.
    const out = await fetchAndCacheSingleSyllabus('EBC-OS', 'en', '4210');

    expect(out).toBe(EN);
    expect(set).toHaveBeenCalledWith('syllabuses', 'EBC-OS', { cz: CZ, en: EN });
  });

  it('gives up without fetching when the id cannot be resolved', async () => {
    findSubjectId.mockResolvedValue(null);

    const out = await fetchAndCacheSingleSyllabus('UNKNOWN', 'cz');

    expect(out).toBeUndefined();
    expect(fetchSyllabus).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('treats an empty-string lookup result as unresolved', async () => {
    findSubjectId.mockResolvedValue('');

    const out = await fetchAndCacheSingleSyllabus('UNKNOWN', 'cz');

    expect(out).toBeUndefined();
    expect(set).not.toHaveBeenCalled();
  });
});
