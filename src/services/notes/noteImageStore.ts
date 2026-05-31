import { IndexedDBService } from '../storage/IndexedDBService';
import { hashBytes } from './imageNormalize';
import type { NoteImage } from '../../types/documents';

/** Blobs created within this window are never swept (covers paste-not-yet-saved). */
export const GC_GRACE_MS = 60_000;

/** Store a normalized image, content-addressed. Returns the hash. Idempotent. */
export async function storeImage(img: { blob: Blob; mime: string; w: number; h: number }): Promise<string> {
    const hash = await hashBytes(await img.blob.arrayBuffer());
    const existing = await IndexedDBService.get('note_images', hash);
    if (existing) return hash; // dedup — identical bytes already stored
    const record: NoteImage = { hash, blob: img.blob, mime: img.mime, w: img.w, h: img.h, createdAt: Date.now() };
    await IndexedDBService.set('note_images', hash, record);
    return hash;
}

export function getImage(hash: string): Promise<NoteImage | undefined> {
    return IndexedDBService.get('note_images', hash);
}

/**
 * Delete blobs that are referenced by no note AND older than the grace window.
 * `referenced` is the union of every card's image hashes across all notes.
 * Returns the number deleted.
 */
export async function sweepOrphans(referenced: Set<string>, now: number): Promise<number> {
    const all = await IndexedDBService.getAllWithKeys('note_images');
    let deleted = 0;
    for (const { key, value } of all) {
        if (referenced.has(key)) continue;
        if (now - value.createdAt < GC_GRACE_MS) continue;
        await IndexedDBService.delete('note_images', key);
        deleted++;
    }
    return deleted;
}
