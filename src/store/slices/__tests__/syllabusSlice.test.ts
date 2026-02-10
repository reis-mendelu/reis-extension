import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSyllabusSlice } from '../createSyllabusSlice';
import { IndexedDBService } from '../../../services/storage';
import { fetchSyllabus, findSubjectId } from '../../../api/syllabus';
import type { SyllabusSlice } from '../types';
import type { SyllabusRequirements } from '../../../types/documents';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../api/syllabus', () => ({
  fetchSyllabus: vi.fn(),
  findSubjectId: vi.fn(),
}));

describe('SyllabusSlice', () => {
  let set: vi.Mock;
  let get: vi.Mock;
  let slice: SyllabusSlice & { language: string };

  beforeEach(() => {
    vi.clearAllMocks();
    set = vi.fn((fn) => {
      const state = fn({ syllabuses: slice.syllabuses });
      Object.assign(slice, state);
    });
    get = vi.fn(() => slice);
    slice = {
      language: 'cz',
      ...createSyllabusSlice(set, get, {} as any),
    } as SyllabusSlice & { language: string };
  });

  it('should fetch from API if not in cache or DB', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(null);
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue({ requirementsText: 'CZ Syllabus', language: 'cz' } as SyllabusRequirements);

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'cz');
    expect(slice.syllabuses.cache['EBC-ALG']).toEqual({ requirementsText: 'CZ Syllabus', language: 'cz' });
    expect(IndexedDBService.set).toHaveBeenCalled();
  });

  it('should use cache if language matches', async () => {
    slice.syllabuses.cache['EBC-ALG'] = { requirementsText: 'CZ Syllabus', language: 'cz' };
    
    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).not.toHaveBeenCalled();
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('should re-fetch if cache language mismatches', async () => {
    slice.syllabuses.cache['EBC-ALG'] = { requirementsText: 'CZ Syllabus', language: 'cz' };
    slice.language = 'en'; // Switch language
    
    vi.mocked(IndexedDBService.get).mockResolvedValue({ requirementsText: 'CZ Syllabus', language: 'cz' });
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue({ requirementsText: 'EN Syllabus', language: 'en' } as SyllabusRequirements);

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'en');
    expect(slice.syllabuses.cache['EBC-ALG']).toEqual({ requirementsText: 'EN Syllabus', language: 'en' });
  });

  it('should re-fetch if DB language mismatches', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue({ requirementsText: 'CZ Syllabus', language: 'cz' });
    slice.language = 'en';
    
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue({ requirementsText: 'EN Syllabus', language: 'en' } as SyllabusRequirements);

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'en');
    expect(slice.syllabuses.cache['EBC-ALG']).toEqual({ requirementsText: 'EN Syllabus', language: 'en' });
  });
});
