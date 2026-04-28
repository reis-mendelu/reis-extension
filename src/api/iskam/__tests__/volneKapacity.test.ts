import { describe, it, expect, vi, afterEach } from 'vitest';
import { academicYearDates } from '../volneKapacity';

afterEach(() => { vi.useRealTimers(); });

describe('academicYearDates', () => {
    it('returns next academic year for January', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 15));
        const { od, doo } = academicYearDates();
        expect(od).toBe('01.09.2026');
        expect(doo).toBe('30.06.2027');
    });

    it('returns next academic year for August', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 1));
        const { od, doo } = academicYearDates();
        expect(od).toBe('01.09.2026');
        expect(doo).toBe('30.06.2027');
    });

    it('returns next academic year for September', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 8, 1));
        const { od, doo } = academicYearDates();
        expect(od).toBe('01.09.2027');
        expect(doo).toBe('30.06.2028');
    });

    it('returns next academic year for December', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 11, 15));
        const { od, doo } = academicYearDates();
        expect(od).toBe('01.09.2027');
        expect(doo).toBe('30.06.2028');
    });
});
