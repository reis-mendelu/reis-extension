import { describe, it, expect } from 'vitest';
import { computeRenderWindow } from '../pdfWindow';

const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe('computeRenderWindow', () => {
    it('renders the visible page plus a buffer on each side', () => {
        expect(sorted(computeRenderWindow(new Set([5]), 100, 2))).toEqual([3, 4, 5, 6, 7]);
    });

    it('clamps the window to [0, numPages)', () => {
        expect(sorted(computeRenderWindow(new Set([0]), 3, 2))).toEqual([0, 1, 2]);
        expect(sorted(computeRenderWindow(new Set([99]), 100, 2))).toEqual([97, 98, 99]);
    });

    it('falls back to the first window before anything has intersected', () => {
        expect(sorted(computeRenderWindow(new Set(), 100, 2))).toEqual([0, 1, 2]);
    });

    it('unions windows around every visible page', () => {
        expect(sorted(computeRenderWindow(new Set([1, 10]), 100, 1))).toEqual([0, 1, 2, 9, 10, 11]);
    });

    it('never exceeds the document length', () => {
        expect(sorted(computeRenderWindow(new Set([0]), 1, 2))).toEqual([0]);
    });
});
