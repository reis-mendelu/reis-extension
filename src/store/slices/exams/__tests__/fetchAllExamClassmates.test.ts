import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
    },
}));

vi.mock('../../../../utils/reportError', () => ({
    logError: vi.fn(),
}));

import { loadAllExamClassmatesFromCache } from '../fetchAllExamClassmates';
import { IndexedDBService } from '../../../../services/storage';
import type { ExamSubject } from '../../../../types/exams';

const makeExam = (registeredIds: (string | undefined)[]): ExamSubject => ({
    version: 1,
    id: 'subj',
    name: 'Subj',
    code: 'CODE',
    sections: registeredIds.map((id, i) => ({
        id: `sec-${i}`,
        name: 'zkouška',
        type: 'exam',
        status: id ? 'registered' : 'open',
        ...(id ? { registeredTerm: { id, date: '01.01', time: '09:00' } } : {}),
        terms: [],
    })),
}) as unknown as ExamSubject;

describe('loadAllExamClassmatesFromCache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when exams is null and IDB has none (cold boot)', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce(null);

        const result = await loadAllExamClassmatesFromCache({ exams: null });
        expect(result).toBeNull();
    });

    it('returns null when no exams have registered terms', async () => {
        const result = await loadAllExamClassmatesFromCache({
            exams: [makeExam([undefined])],
        });
        expect(result).toBeNull();
    });

    it('skips synthetic open-term ids that contain "-"', async () => {
        const result = await loadAllExamClassmatesFromCache({
            exams: [makeExam(['open-1-foo'])],
        });
        expect(result).toBeNull();
    });

    it('returns keyed map when exams have registered terms and IDB has entries', async () => {
        const rosterA = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
        const rosterB = [{ personId: 2, name: 'B', photoUrl: 'p', studyInfo: 's' }];
        vi.mocked(IndexedDBService.get)
            .mockResolvedValueOnce(rosterA)
            .mockResolvedValueOnce(rosterB);

        const result = await loadAllExamClassmatesFromCache({
            exams: [makeExam(['111', '222'])],
        });

        expect(result).toEqual({ '111': rosterA, '222': rosterB });
        expect(IndexedDBService.get).toHaveBeenCalledWith('classmates', 'exam:111');
        expect(IndexedDBService.get).toHaveBeenCalledWith('classmates', 'exam:222');
    });

    it('drops non-array cache entries', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce({ corrupt: true } as never);

        const result = await loadAllExamClassmatesFromCache({
            exams: [makeExam(['111'])],
        });
        expect(result).toEqual({});
    });

    it('returns null when IDB read throws', async () => {
        vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('idb down'));

        const result = await loadAllExamClassmatesFromCache({
            exams: [makeExam(['111'])],
        });
        expect(result).toBeNull();
    });
});
