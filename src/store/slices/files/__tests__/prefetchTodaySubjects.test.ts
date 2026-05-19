import { describe, it, expect, vi } from 'vitest';
import { prefetchTodaySubjectsImpl, PREFETCH_MAX, PREFETCH_STALE_MS } from '../prefetchTodaySubjects';
import type { BlockLesson } from '../../../../types/schedule';

function lesson(date: string, courseCode: string, id = '1'): BlockLesson {
    return {
        date, courseCode, id,
        isConsultation: '', room: '', roomStructured: { name: '', id: '' },
        studyId: '', endTime: '10:00', facultyCode: '', startTime: '09:00',
        isDefaultCampus: '', courseId: '', courseName: '', campus: '',
        isSeminar: '', teachers: [], periodId: '',
    };
}

const TODAY = new Date('2026-05-19T10:00:00');
const TODAY_STR = '20260519';
const NOW = TODAY.getTime();

describe('prefetchTodaySubjectsImpl', () => {
    it('fires refresh for each unique today-code', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = prefetchTodaySubjectsImpl({
            schedule: [lesson(TODAY_STR, 'ALG'), lesson(TODAY_STR, 'BIO')],
            lastFilesFetchedAt: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toEqual(new Set(['ALG', 'BIO']));
        expect(refresh).toHaveBeenCalledTimes(2);
        expect(refresh).toHaveBeenCalledWith('ALG');
        expect(refresh).toHaveBeenCalledWith('BIO');
    });

    it('skips subjects fetched within PREFETCH_STALE_MS', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = prefetchTodaySubjectsImpl({
            schedule: [lesson(TODAY_STR, 'ALG'), lesson(TODAY_STR, 'BIO')],
            lastFilesFetchedAt: { ALG: NOW - 1000 },
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toEqual(new Set(['BIO']));
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledWith('BIO');
    });

    it('does not skip subjects fetched longer than PREFETCH_STALE_MS ago', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = prefetchTodaySubjectsImpl({
            schedule: [lesson(TODAY_STR, 'ALG')],
            lastFilesFetchedAt: { ALG: NOW - PREFETCH_STALE_MS - 1 },
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toEqual(new Set(['ALG']));
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('caps fires at PREFETCH_MAX', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const schedule = Array.from({ length: PREFETCH_MAX + 4 }, (_, i) => lesson(TODAY_STR, `S${i}`));
        const fired = prefetchTodaySubjectsImpl({
            schedule,
            lastFilesFetchedAt: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired.size).toBe(PREFETCH_MAX);
        expect(refresh).toHaveBeenCalledTimes(PREFETCH_MAX);
    });

    it('does nothing when no lessons scheduled today', () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const fired = prefetchTodaySubjectsImpl({
            schedule: [lesson('20260518', 'ALG'), lesson('20260520', 'BIO')],
            lastFilesFetchedAt: {},
            refreshFilesForSubject: refresh,
            now: NOW,
        });
        expect(fired).toEqual(new Set());
        expect(refresh).not.toHaveBeenCalled();
    });

    it('swallows rejection from refreshFilesForSubject without throwing', () => {
        const refresh = vi.fn().mockRejectedValue(new Error('network down'));
        expect(() => {
            prefetchTodaySubjectsImpl({
                schedule: [lesson(TODAY_STR, 'ALG')],
                lastFilesFetchedAt: {},
                refreshFilesForSubject: refresh,
                now: NOW,
            });
        }).not.toThrow();
        expect(refresh).toHaveBeenCalledWith('ALG');
    });
});
