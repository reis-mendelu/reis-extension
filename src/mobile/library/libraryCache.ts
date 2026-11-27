import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';
import type { Block } from './availability';

/** The `meta` key holding the library's last answer. It carries free and taken hours, nothing about anyone. */
export const SAVED_KEY = 'library_availability';
/** An answer older than this is not shown while a new one loads: it would be yesterday's. */
export const SAVED_MAX_MS = 12 * 60 * 60 * 1000;

export interface SavedAnswer {
  savedAt: number;
  blocks: Record<number, Block[] | null>;
}

/**
 * The library takes 10–15 s to answer at times (measured 2026-11-27, 18:44), so
 * the card shows the last answer at once, marked with when it was taken, and the
 * read replaces it. A hour that is not free any more is caught by the check every
 * booking makes against the library first.
 */
export async function readSaved(now: number): Promise<SavedAnswer | null> {
  try {
    const v = (await IndexedDBService.get('meta', SAVED_KEY)) as Partial<SavedAnswer> | undefined;
    if (!v || typeof v.savedAt !== 'number' || typeof v.blocks !== 'object' || !v.blocks)
      return null;
    const age = now - v.savedAt;
    return age >= 0 && age < SAVED_MAX_MS ? (v as SavedAnswer) : null;
  } catch (err) {
    logError('Library.readSaved', err);
    return null;
  }
}

export function writeSaved(blocks: Record<number, Block[] | null>, savedAt: number): void {
  IndexedDBService.set('meta', SAVED_KEY, { savedAt, blocks }).catch((err) =>
    logError('Library.writeSaved', err)
  );
}
