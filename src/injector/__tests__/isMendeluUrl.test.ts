import { describe, it, expect } from 'vitest';
import { isIsMendeluUrl } from '../isMendeluUrl';

describe('isIsMendeluUrl', () => {
    it('accepts https URLs on the exact is.mendelu.cz origin', () => {
        expect(isIsMendeluUrl('https://is.mendelu.cz')).toBe(true);
        expect(isIsMendeluUrl('https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1')).toBe(true);
        expect(isIsMendeluUrl('https://is.mendelu.cz:443/auth/')).toBe(true);
    });

    it('rejects look-alike hosts that the old startsWith check let through', () => {
        // The core vulnerability: startsWith('https://is.mendelu.cz') matched these.
        expect(isIsMendeluUrl('https://is.mendelu.cz.evil.com/steal')).toBe(false);
        expect(isIsMendeluUrl('https://is.mendelu.czattacker.example')).toBe(false);
    });

    it('rejects other schemes and hosts', () => {
        expect(isIsMendeluUrl('http://is.mendelu.cz/auth/')).toBe(false); // not https
        expect(isIsMendeluUrl('https://evil.com/is.mendelu.cz')).toBe(false);
        expect(isIsMendeluUrl('https://sub.is.mendelu.cz/')).toBe(false); // different host
    });

    it('rejects malformed / non-URL input without throwing', () => {
        expect(isIsMendeluUrl('not a url')).toBe(false);
        expect(isIsMendeluUrl('')).toBe(false);
        expect(isIsMendeluUrl('javascript:alert(1)')).toBe(false);
    });
});
