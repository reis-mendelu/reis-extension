import { describe, it, expect } from 'vitest';
import { ringContains } from '../mapHelpers';

// Rings are [lon, lat] pairs, the GeoJSON convention buildings.json uses.
const square: number[][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

// An L, so the bounding box covers ground the building does not. This is the
// whole reason the floor-view exit tests the outline instead of the bounds:
// tapping the notch of an L-shaped building is tapping OUTSIDE it.
const lShape: number[][] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10], [0, 0]];

describe('ringContains', () => {
    it('accepts a point well inside', () => {
        expect(ringContains(square, 5, 5)).toBe(true);
    });

    it.each([
        ['left', -1, 5],
        ['right', 11, 5],
        ['below', 5, -1],
        ['above', 5, 11],
    ])('rejects a point %s of the ring', (_where, lon, lat) => {
        expect(ringContains(square, lon, lat)).toBe(false);
    });

    it('rejects the notch of an L, which its bounding box would accept', () => {
        // (7, 7) sits inside the bounds [0,0]–[10,10] but outside the L itself.
        expect(ringContains(lShape, 7, 7)).toBe(false);
        expect(ringContains(lShape, 7, 2)).toBe(true);
        expect(ringContains(lShape, 2, 7)).toBe(true);
    });

    it('handles a ring that is not explicitly closed', () => {
        const open = square.slice(0, -1);
        expect(ringContains(open, 5, 5)).toBe(true);
        expect(ringContains(open, 15, 5)).toBe(false);
    });

    it('returns false for a degenerate ring rather than throwing', () => {
        expect(ringContains([], 1, 1)).toBe(false);
        expect(ringContains([[0, 0], [1, 1]], 0.5, 0.5)).toBe(false);
    });
});
