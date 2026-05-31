import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeImage, getImage, sweepOrphans } from '../noteImageStore';
import { IndexedDBService } from '../../storage/IndexedDBService';

const jpeg = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('noteImageStore', () => {
    beforeEach(async () => { await IndexedDBService.clear('note_images'); });

    it('stores an image and returns its content hash', async () => {
        const hash = await storeImage({ blob: jpeg([1, 2, 3]), mime: 'image/jpeg', w: 10, h: 10 });
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        const got = await getImage(hash);
        expect(got?.w).toBe(10);
        expect(got?.mime).toBe('image/jpeg');
    });

    it('dedups identical bytes to the same hash (single row)', async () => {
        const a = await storeImage({ blob: jpeg([4, 5]), mime: 'image/jpeg', w: 1, h: 1 });
        const b = await storeImage({ blob: jpeg([4, 5]), mime: 'image/jpeg', w: 1, h: 1 });
        expect(a).toBe(b);
        const all = await IndexedDBService.getAllWithKeys('note_images');
        expect(all.filter((e) => e.key === a)).toHaveLength(1);
    });

    it('sweepOrphans deletes unreferenced blobs older than the grace window', async () => {
        const keep = await storeImage({ blob: jpeg([7]), mime: 'image/jpeg', w: 1, h: 1 });
        const drop = await storeImage({ blob: jpeg([8]), mime: 'image/jpeg', w: 1, h: 1 });
        // Backdate both beyond the grace window.
        for (const h of [keep, drop]) {
            const img = await getImage(h);
            await IndexedDBService.set('note_images', h, { ...img!, createdAt: 0 });
        }
        const deleted = await sweepOrphans(new Set([keep]), Date.now());
        expect(deleted).toBe(1);
        expect(await getImage(drop)).toBeUndefined();
        expect(await getImage(keep)).toBeDefined();
    });

    it('sweepOrphans never deletes blobs inside the grace window', async () => {
        const fresh = await storeImage({ blob: jpeg([9]), mime: 'image/jpeg', w: 1, h: 1 });
        const deleted = await sweepOrphans(new Set(), Date.now()); // referenced by nobody, but fresh
        expect(deleted).toBe(0);
        expect(await getImage(fresh)).toBeDefined();
    });

    it('propagates a QuotaExceededError from the underlying store', async () => {
        const err = new DOMException('quota', 'QuotaExceededError');
        const spy = vi.spyOn(IndexedDBService, 'set').mockRejectedValueOnce(err);
        await expect(
            storeImage({ blob: jpeg([1, 1, 1]), mime: 'image/jpeg', w: 1, h: 1 }),
        ).rejects.toThrow('quota');
        spy.mockRestore();
    });
});
