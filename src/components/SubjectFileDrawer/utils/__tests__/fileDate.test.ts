import { describe, it, expect } from 'vitest';
import { parseIsDate, isRecent, RECENT_THRESHOLD_DAYS } from '../fileDate';

const DAY_MS = 86_400_000;

describe('parseIsDate', () => {
    it('parses DD.MM.YYYY', () => {
        const d = parseIsDate('05.03.2026');
        expect(d?.getFullYear()).toBe(2026);
        expect(d?.getMonth()).toBe(2);
        expect(d?.getDate()).toBe(5);
    });

    it('parses single-digit day/month variants', () => {
        const d = parseIsDate('5.3.2026');
        expect(d?.getDate()).toBe(5);
        expect(d?.getMonth()).toBe(2);
    });

    it('parses YYYY-MM-DD fallback', () => {
        const d = parseIsDate('2026-03-05');
        expect(d?.getDate()).toBe(5);
        expect(d?.getMonth()).toBe(2);
    });

    it('returns null for malformed strings', () => {
        expect(parseIsDate('')).toBeNull();
        expect(parseIsDate(undefined)).toBeNull();
        expect(parseIsDate(null)).toBeNull();
        expect(parseIsDate('not a date')).toBeNull();
        expect(parseIsDate('2026/03/05')).toBeNull();
    });

    it('rejects invalid calendar dates', () => {
        expect(parseIsDate('31.02.2026')).toBeNull();
        expect(parseIsDate('32.01.2026')).toBeNull();
        expect(parseIsDate('00.05.2026')).toBeNull();
    });
});

describe('isRecent', () => {
    const now = new Date(2026, 4, 19).getTime();

    it('flags files within the threshold', () => {
        const fiveDaysAgo = new Date(now - 5 * DAY_MS);
        const formatted = `${fiveDaysAgo.getDate()}.${fiveDaysAgo.getMonth() + 1}.${fiveDaysAgo.getFullYear()}`;
        expect(isRecent(formatted, now)).toBe(true);
    });

    it('rejects files older than the threshold', () => {
        const longAgo = new Date(now - (RECENT_THRESHOLD_DAYS + 5) * DAY_MS);
        const formatted = `${longAgo.getDate()}.${longAgo.getMonth() + 1}.${longAgo.getFullYear()}`;
        expect(isRecent(formatted, now)).toBe(false);
    });

    it('treats future-dated files as recent', () => {
        const tomorrow = new Date(now + DAY_MS);
        const formatted = `${tomorrow.getDate()}.${tomorrow.getMonth() + 1}.${tomorrow.getFullYear()}`;
        expect(isRecent(formatted, now)).toBe(true);
    });

    it('returns false for unparseable input', () => {
        expect(isRecent('', now)).toBe(false);
        expect(isRecent('garbage', now)).toBe(false);
        expect(isRecent(undefined, now)).toBe(false);
    });
});
