/**
 * Tests for Semester Sorting Utility
 * 
 * Single Point of Failure: Chronological ordering of semesters.
 * If this fails, UI shows wrong semester as "current".
 */

import { describe, it, expect } from 'vitest';
import { compareSemesters, sortSemesters } from './semesterSort';

describe('compareSemesters', () => {
    it('sorts newer year before older year', () => {
        const a = { year: 2024, semesterName: 'ZS 2024/2025' };
        const b = { year: 2023, semesterName: 'ZS 2023/2024' };
        expect(compareSemesters(a, b)).toBeLessThan(0);
    });

    it('sorts LS before ZS within same academic year', () => {
        const ls = { year: 2024, semesterName: 'LS 2024/2025' };
        const zs = { year: 2024, semesterName: 'ZS 2024/2025' };
        expect(compareSemesters(ls, zs)).toBeLessThan(0);
    });

    it('sorts ZS after LS within same academic year', () => {
        const zs = { year: 2024, semesterName: 'ZS 2024/2025' };
        const ls = { year: 2024, semesterName: 'LS 2024/2025' };
        expect(compareSemesters(zs, ls)).toBeGreaterThan(0);
    });

    it('handles semester names with faculty suffix', () => {
        const ls = { year: 2024, semesterName: 'LS 2024/2025 - FRRMS' };
        const zs = { year: 2024, semesterName: 'ZS 2024/2025 - PEF' };
        expect(compareSemesters(ls, zs)).toBeLessThan(0);
    });
});

describe('sortSemesters', () => {
    it('sorts chronologically newest first', () => {
        const semesters = [
            { year: 2022, semesterName: 'LS 2022/2023 - FRRMS' },
            { year: 2024, semesterName: 'LS 2024/2025 - FRRMS' },
            { year: 2023, semesterName: 'LS 2023/2024 - FRRMS' },
        ];
        
        const sorted = sortSemesters(semesters);
        
        expect(sorted[0].year).toBe(2024);
        expect(sorted[1].year).toBe(2023);
        expect(sorted[2].year).toBe(2022);
    });

    it('handles mixed ZS and LS semesters correctly', () => {
        const semesters = [
            { year: 2024, semesterName: 'ZS 2024/2025' },
            { year: 2024, semesterName: 'LS 2024/2025' },
            { year: 2023, semesterName: 'ZS 2023/2024' },
            { year: 2023, semesterName: 'LS 2023/2024' },
        ];
        
        const sorted = sortSemesters(semesters);
        
        // Expected order: LS 24/25 > ZS 24/25 > LS 23/24 > ZS 23/24
        expect(sorted[0].semesterName).toContain('LS 2024');
        expect(sorted[1].semesterName).toContain('ZS 2024');
        expect(sorted[2].semesterName).toContain('LS 2023');
        expect(sorted[3].semesterName).toContain('ZS 2023');
    });

    it('preserves original array (immutability)', () => {
        const original = [
            { year: 2022, semesterName: 'ZS' },
            { year: 2024, semesterName: 'ZS' },
        ];
        const sorted = sortSemesters(original);
        
        expect(original[0].year).toBe(2022); // Original unchanged
        expect(sorted[0].year).toBe(2024);   // Sorted copy
    });
});

// --- @arch-guardian Edge Cases ---
describe('semester sorting edge cases', () => {
    it('handles undefined semesterName gracefully', () => {
        const semesters = [
            { year: 2024, semesterName: undefined as unknown as string },
            { year: 2023, semesterName: 'ZS 2023/2024' },
        ];
        // Should not throw
        const sorted = sortSemesters(semesters);
        expect(sorted.length).toBe(2);
    });

    it('handles empty semesterName', () => {
        const semesters = [
            { year: 2024, semesterName: '' },
            { year: 2023, semesterName: 'ZS 2023/2024' },
        ];
        const sorted = sortSemesters(semesters);
        expect(sorted.length).toBe(2);
    });

    it('handles unknown semester type', () => {
        const semesters = [
            { year: 2024, semesterName: 'SS 2024/2025' }, // Invalid type
            { year: 2024, semesterName: 'LS 2024/2025' },
        ];
        const sorted = sortSemesters(semesters);
        // Should sort by year when type is unknown
        expect(sorted).toBeDefined();
    });

    it('handles same year same type (stable sort)', () => {
        const semesters = [
            { year: 2024, semesterName: 'ZS 2024/2025 - PEF' },
            { year: 2024, semesterName: 'ZS 2024/2025 - AF' },
        ];
        const sorted = sortSemesters(semesters);
        // Both should be present, order is implementation-defined
        expect(sorted.length).toBe(2);
    });
});
