import { describe, it, expect } from 'vitest';
import { computeTargetDimensions, hashBytes, blobToBase64 } from '../imageNormalize';

describe('computeTargetDimensions', () => {
    it('leaves small images unchanged', () => {
        expect(computeTargetDimensions(800, 600, 1600)).toEqual({ w: 800, h: 600 });
    });
    it('scales the longest edge (landscape) to the cap, preserving ratio', () => {
        expect(computeTargetDimensions(3200, 1600, 1600)).toEqual({ w: 1600, h: 800 });
    });
    it('scales the longest edge (portrait) to the cap, preserving ratio', () => {
        expect(computeTargetDimensions(1600, 3200, 1600)).toEqual({ w: 800, h: 1600 });
    });
    it('rounds to whole pixels', () => {
        expect(computeTargetDimensions(1000, 333, 500)).toEqual({ w: 500, h: 167 });
    });
});

describe('hashBytes', () => {
    it('is stable for identical bytes', async () => {
        const a = await hashBytes(new Uint8Array([1, 2, 3]).buffer);
        const b = await hashBytes(new Uint8Array([1, 2, 3]).buffer);
        expect(a).toBe(b);
    });
    it('differs for different bytes', async () => {
        const a = await hashBytes(new Uint8Array([1, 2, 3]).buffer);
        const b = await hashBytes(new Uint8Array([1, 2, 4]).buffer);
        expect(a).not.toBe(b);
    });
    it('returns 64 hex chars (full SHA-256)', async () => {
        const a = await hashBytes(new Uint8Array([9]).buffer);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('blobToBase64', () => {
    it('encodes bytes to base64 with no data: prefix', async () => {
        const out = await blobToBase64(new Blob([new Uint8Array([72, 105])])); // "Hi"
        expect(out).toBe('SGk=');
        expect(out).not.toContain('data:');
    });
});
