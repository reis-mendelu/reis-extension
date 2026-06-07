import { describe, it, expect } from 'vitest';
import { isEmptyCollection, wouldWipePopulated } from './guards';

describe('isEmptyCollection', () => {
    it('treats null/undefined as empty', () => {
        expect(isEmptyCollection(null)).toBe(true);
        expect(isEmptyCollection(undefined)).toBe(true);
    });

    it('treats [] and {} as empty', () => {
        expect(isEmptyCollection([])).toBe(true);
        expect(isEmptyCollection({})).toBe(true);
    });

    it('treats populated array/record as non-empty', () => {
        expect(isEmptyCollection([1])).toBe(false);
        expect(isEmptyCollection({ a: 1 })).toBe(false);
    });
});

describe('wouldWipePopulated', () => {
    it('skips when incoming is empty but the store is populated', () => {
        expect(wouldWipePopulated([], [1, 2])).toBe(true);
        expect(wouldWipePopulated({}, { a: 1 })).toBe(true);
    });

    it('does not skip a null/undefined push without crashing (null-hardened)', () => {
        expect(wouldWipePopulated(null, { a: 1 })).toBe(true);
        expect(wouldWipePopulated(undefined, [1])).toBe(true);
    });

    it('allows the update when incoming has data', () => {
        expect(wouldWipePopulated([1], [2, 3])).toBe(false);
        expect(wouldWipePopulated({ a: 1 }, { b: 2 })).toBe(false);
    });

    it('allows an empty update when the store is also empty (first-load / no crash on null current)', () => {
        expect(wouldWipePopulated([], [])).toBe(false);
        expect(wouldWipePopulated({}, null)).toBe(false);
        expect(wouldWipePopulated(null, undefined)).toBe(false);
    });
});
