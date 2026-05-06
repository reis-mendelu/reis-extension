import { describe, it, expect } from 'vitest';
import {
    sanitizeMessage,
    sanitizeFilePath,
    getBrowserInfo,
    dedupeKey,
} from '../sanitize';

describe('sanitizeMessage', () => {
    it('strips 6-digit UIC numbers', () => {
        const out = sanitizeMessage('Failed to load user 123456 grades');
        expect(out).not.toContain('123456');
    });

    it('strips MENDELU email addresses', () => {
        const out = sanitizeMessage('User xnovak@mendelu.cz lookup failed');
        expect(out).not.toContain('xnovak@mendelu.cz');
        expect(out).not.toContain('mendelu.cz');
    });

    it('strips Bearer tokens', () => {
        const out = sanitizeMessage('401 with Bearer eyJhbGciOiJIUzI1NiJ9.foo');
        expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9.foo');
        expect(out).not.toContain('Bearer ');
    });

    it('strips Cookie header content', () => {
        const out = sanitizeMessage('Request failed Cookie: session=abc123def');
        expect(out).not.toContain('session=abc123def');
    });

    it('strips IS Mendelu URLs with query strings', () => {
        const out = sanitizeMessage(
            'fetch error: https://is.mendelu.cz/auth/student/index.pl?id=123456&token=secret'
        );
        expect(out).not.toContain('id=123456');
        expect(out).not.toContain('token=secret');
    });

    it('truncates messages longer than 500 characters', () => {
        const long = 'x'.repeat(1000);
        const out = sanitizeMessage(long);
        expect(out).not.toBeNull();
        expect(out!.length).toBeLessThanOrEqual(500);
    });

    it('returns null for empty input', () => {
        expect(sanitizeMessage('')).toBeNull();
        expect(sanitizeMessage('   ')).toBeNull();
    });

    it('returns null for non-string input', () => {
        expect(sanitizeMessage(undefined)).toBeNull();
        expect(sanitizeMessage(null)).toBeNull();
        expect(sanitizeMessage(42)).toBeNull();
    });

    it('preserves benign error text', () => {
        const out = sanitizeMessage("Cannot read properties of undefined (reading 'foo')");
        expect(out).toBe("Cannot read properties of undefined (reading 'foo')");
    });
});

describe('sanitizeFilePath', () => {
    it('strips query strings', () => {
        const out = sanitizeFilePath('chrome-extension://abc/main.js?v=123');
        expect(out).not.toContain('?v=123');
    });

    it('strips fragments', () => {
        const out = sanitizeFilePath('chrome-extension://abc/main.js#token=secret');
        expect(out).not.toContain('#token=secret');
    });

    it('reduces a chrome-extension URL to filename', () => {
        const out = sanitizeFilePath('chrome-extension://abcdef123/main/main.js');
        expect(out).toBe('main.js');
    });

    it('handles empty input', () => {
        expect(sanitizeFilePath('')).toBe('');
    });

    it('truncates absurdly long paths', () => {
        const long = 'chrome-extension://abc/' + 'a/'.repeat(500) + 'main.js';
        const out = sanitizeFilePath(long);
        expect(out.length).toBeLessThanOrEqual(500);
    });
});

describe('getBrowserInfo', () => {
    it('detects Chrome from a Chrome user agent', () => {
        const ua =
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        const out = getBrowserInfo(ua);
        expect(out.name).toBe('Chrome');
        expect(out.version).toBe('124');
    });

    it('detects Firefox', () => {
        const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
        const out = getBrowserInfo(ua);
        expect(out.name).toBe('Firefox');
        expect(out.version).toBe('127');
    });

    it('detects Edge', () => {
        const ua =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.51';
        const out = getBrowserInfo(ua);
        expect(out.name).toBe('Edge');
        expect(out.version).toBe('124');
    });

    it('falls back to Unknown for empty UA', () => {
        const out = getBrowserInfo('');
        expect(out.name).toBe('Unknown');
        expect(out.version).toBe('0');
    });
});

describe('dedupeKey', () => {
    it('produces stable keys for identical inputs', () => {
        expect(dedupeKey('Error', 'msg', 'main.js', 10)).toBe(
            dedupeKey('Error', 'msg', 'main.js', 10)
        );
    });

    it('differs when any field changes', () => {
        const base = dedupeKey('Error', 'msg', 'main.js', 10);
        expect(dedupeKey('TypeError', 'msg', 'main.js', 10)).not.toBe(base);
        expect(dedupeKey('Error', 'msg2', 'main.js', 10)).not.toBe(base);
        expect(dedupeKey('Error', 'msg', 'other.js', 10)).not.toBe(base);
        expect(dedupeKey('Error', 'msg', 'main.js', 11)).not.toBe(base);
    });
});
