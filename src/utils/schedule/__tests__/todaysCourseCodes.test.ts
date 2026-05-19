import { describe, it, expect } from 'vitest';
import { todaysCourseCodes } from '../todaysCourseCodes';
import type { BlockLesson } from '../../../types/schedule';

function lesson(date: string, courseCode: string, id = '1'): BlockLesson {
    return {
        date,
        courseCode,
        id,
        isConsultation: '',
        room: '',
        roomStructured: { name: '', id: '' },
        studyId: '',
        endTime: '10:00',
        facultyCode: '',
        startTime: '09:00',
        isDefaultCampus: '',
        courseId: '',
        courseName: '',
        campus: '',
        isSeminar: '',
        teachers: [],
        periodId: '',
    };
}

describe('todaysCourseCodes', () => {
    it('returns codes only for today', () => {
        const now = new Date('2026-05-19T10:00:00');
        const lessons = [
            lesson('20260519', 'ALG'),
            lesson('20260518', 'BIO'),
            lesson('20260520', 'CHM'),
            lesson('20260519', 'PHY'),
        ];
        expect(todaysCourseCodes(lessons, now)).toEqual(new Set(['ALG', 'PHY']));
    });

    it('deduplicates the same course code across multiple lessons today', () => {
        const now = new Date('2026-05-19T10:00:00');
        const lessons = [
            lesson('20260519', 'ALG', '1'),
            lesson('20260519', 'ALG', '2'),
            lesson('20260519', 'ALG', '3'),
        ];
        expect(todaysCourseCodes(lessons, now)).toEqual(new Set(['ALG']));
    });

    it('returns empty set when no lessons today', () => {
        const now = new Date('2026-05-19T10:00:00');
        const lessons = [
            lesson('20260518', 'ALG'),
            lesson('20260520', 'BIO'),
        ];
        expect(todaysCourseCodes(lessons, now)).toEqual(new Set());
    });

    it('returns empty set for empty schedule', () => {
        const now = new Date('2026-05-19T10:00:00');
        expect(todaysCourseCodes([], now)).toEqual(new Set());
    });

    it('handles single-digit months and days with zero-padding', () => {
        const now = new Date('2026-01-05T10:00:00');
        const lessons = [
            lesson('20260105', 'ALG'),
            lesson('20260106', 'BIO'),
        ];
        expect(todaysCourseCodes(lessons, now)).toEqual(new Set(['ALG']));
    });

    it('skips lessons with empty courseCode', () => {
        const now = new Date('2026-05-19T10:00:00');
        const lessons = [
            lesson('20260519', ''),
            lesson('20260519', 'ALG'),
        ];
        expect(todaysCourseCodes(lessons, now)).toEqual(new Set(['ALG']));
    });
});
