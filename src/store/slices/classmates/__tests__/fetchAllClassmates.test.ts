import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
    },
}));

vi.mock('../../../../utils/reportError', () => ({
    logError: vi.fn(),
}));

import { loadAllClassmatesFromCache } from '../fetchAllClassmates';
import { IndexedDBService } from '../../../../services/storage';

describe('loadAllClassmatesFromCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when subjects is null and IDB has no subjects (cold boot)', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce(null);

        const result = await loadAllClassmatesFromCache({ subjects: null });

        expect(result).toBeNull();
    });

    it('returns null when subjects.data is empty (no enrolled courses)', async () => {
        const result = await loadAllClassmatesFromCache({
            subjects: { data: {}, availablePeriods: [] } as never,
        });

        expect(result).toBeNull();
    });

    it('returns a keyed map when subjects are present and IDB has entries', async () => {
        const subjects = {
            data: { ALG: { subjectId: '1' }, BIO: { subjectId: '2' } },
            availablePeriods: [],
        } as never;
        const algRoster = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
        const bioRoster = [{ personId: 2, name: 'B', photoUrl: 'p', studyInfo: 's' }];
        vi.mocked(IndexedDBService.get)
            .mockResolvedValueOnce(algRoster)
            .mockResolvedValueOnce(bioRoster);

        const result = await loadAllClassmatesFromCache({ subjects });

        expect(result).toEqual({ ALG: algRoster, BIO: bioRoster });
    });

    it('skips entries that are not arrays (corrupt cache)', async () => {
        const subjects = {
            data: { ALG: { subjectId: '1' }, BIO: { subjectId: '2' } },
            availablePeriods: [],
        } as never;
        const algRoster = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
        vi.mocked(IndexedDBService.get)
            .mockResolvedValueOnce(algRoster)
            .mockResolvedValueOnce({ corrupt: true } as never);

        const result = await loadAllClassmatesFromCache({ subjects });

        expect(result).toEqual({ ALG: algRoster });
    });

    it('returns null when IDB read throws (error path does not poison the store)', async () => {
        vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('idb down'));

        const result = await loadAllClassmatesFromCache({ subjects: null });

        expect(result).toBeNull();
    });
});
