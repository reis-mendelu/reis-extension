/**
 * Tests for Success Rate Validators
 * 
 * These are MODULAR tests targeting single points of failure.
 * No mocking of expensive scrapers. Just pure validation logic.
 */

import { describe, it, expect } from 'vitest';
import { 
    parseSemesterName, 
    validateDataShape,
    checkCDNAvailability 
} from './successRate.validators';

// --- Test #1: Semester Format Parsing (SPOF #2) ---

describe('parseSemesterName', () => {
    it('parses LS semester correctly', () => {
        const result = parseSemesterName('LS 2024/2025 - FRRMS');
        expect(result.isWinter).toBe(false);
        expect(result.yearStart).toBe(2024);
        expect(result.yearLabel).toBe('LS 24/25');
    });

    it('parses ZS semester correctly', () => {
        const result = parseSemesterName('ZS 2024/2025 - PEF');
        expect(result.isWinter).toBe(true);
        expect(result.yearStart).toBe(2024);
        expect(result.yearLabel).toBe('ZS 24/25');
    });

    it('handles semester name without faculty suffix', () => {
        const result = parseSemesterName('ZS 2023/2024');
        expect(result.isWinter).toBe(true);
        expect(result.yearStart).toBe(2023);
        expect(result.yearLabel).toBe('ZS 23/24');
    });

    it('handles malformed semester name gracefully', () => {
        const result = parseSemesterName('Unknown format');
        expect(result.yearStart).toBe(0);
        expect(result.yearLabel).toBe('LS 0/1'); // Fallback
    });
});

// --- Test #2: Data Shape Validation (SPOF #3) ---

describe('validateDataShape', () => {
    it('rejects null data', () => {
        const result = validateDataShape(null);
        expect(result.status).toBe('invalid');
    });

    it('rejects data without courseCode', () => {
        const result = validateDataShape({ stats: [] });
        expect(result.status).toBe('invalid');
        expect(result.message).toContain('courseCode');
    });

    it('rejects data without stats array', () => {
        const result = validateDataShape({ courseCode: 'TEST' });
        expect(result.status).toBe('invalid');
        expect(result.message).toContain('stats array');
    });

    it('rejects empty stats array', () => {
        const result = validateDataShape({ courseCode: 'TEST', stats: [] });
        expect(result.status).toBe('invalid');
        expect(result.message).toContain('Empty stats');
    });

    it('accepts valid data structure', () => {
        const result = validateDataShape({
            courseCode: 'VS',
            stats: [
                { semesterName: 'LS 2024/2025 - FRRMS', year: 2024, totalPass: 98, totalFail: 3, terms: [] }
            ],
            lastUpdated: new Date().toISOString()
        });
        expect(result.status).toBe('ok');
    });

    it('rejects zero student count without terms', () => {
        const result = validateDataShape({
            courseCode: 'TEST',
            stats: [{ semesterName: 'LS 2024', year: 2024, totalPass: 0, totalFail: 0, terms: [] }]
        });
        expect(result.status).toBe('invalid');
        expect(result.message).toContain('Zero student count');
    });

    it('rejects unrealistically high student count', () => {
        const result = validateDataShape({
            courseCode: 'TEST',
            stats: [{ semesterName: 'LS 2024', year: 2024, totalPass: 6000, totalFail: 0 }]
        });
        expect(result.status).toBe('invalid');
        expect(result.message).toContain('Unrealistically high');
    });

    it('rejects grade sum mismatch', () => {
        const result = validateDataShape({
            courseCode: 'TEST',
            stats: [{ 
                semesterName: 'LS 2024', 
                year: 2024,
                totalPass: 10, 
                totalFail: 0,
                terms: [{ pass: 10, fail: 0, grades: { A: 5 } }] // 5 != 10
            }]
        });
        expect(result.status).toBe('invalid');
        expect(result.message).toContain('Grade sum mismatch');
    });
});

// --- Test #3: Known Problematic Subjects (Live CDN Check) ---
// These are INTEGRATION tests - skip in unit test runner.
// Run separately with: npx tsx src/api/successRate.validators.ts audit EBC-OS VS

describe.skip('checkCDNAvailability (live) - INTEGRATION', () => {
    it('detects missing EBC-OS subject', async () => {
        const result = await checkCDNAvailability('EBC-OS');
        // This should fail because EBC-OS doesn't exist in CDN
        expect(result.status).toBe('missing');
        expect(result.message).toContain('NOT FOUND');
    });

    it('confirms VS subject exists', async () => {
        const result = await checkCDNAvailability('VS');
        expect(result.status).toBe('ok');
    });

    it('handles non-existent random subject', async () => {
        const result = await checkCDNAvailability('DEFINITELY-NOT-EXIST-12345');
        expect(result.status).toBe('missing');
    });
});
