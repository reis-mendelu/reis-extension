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

    it('does not cap when the window is within maxRendered', () => {
        expect(computeRenderWindow(new Set([5]), 100, 2, 20).size).toBe(5);
    });

    it('caps the window to maxRendered, keeping the topmost (lowest) indices in view', () => {
        const visible = new Set<number>();
        for (let i = 10; i <= 40; i++) visible.add(i); // 31 short pages on screen at once
        const r = computeRenderWindow(visible, 100, 2, 20);
        expect(r.size).toBe(20);
        // window starts at minVisible - buffer = 8, contiguous
        expect(sorted(r)).toEqual(Array.from({ length: 20 }, (_, k) => 8 + k));
    });
});
