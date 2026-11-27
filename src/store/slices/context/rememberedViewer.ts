import { IndexedDBService } from '../../../services/storage/IndexedDBService';

/** Who the student was last time IS said so: the event audience's fallback. */
export const VIEWER_KEY = 'viewer_audience';
/** How long a remembered Erasmus status is trusted without IS confirming it. */
const ERASMUS_CACHE_MS = 120 * 24 * 60 * 60 * 1000;

interface StoredViewer {
  faculty: string | null;
  erasmus: boolean;
  programme?: string | null;
  savedAt?: number;
}

/** The store's identity keys, as the student's own record on disk has them. */
export interface RememberedViewer {
  userFaculty: string | null;
  userProgramme: string | null;
  isErasmus: boolean;
}

/**
 * The student's own identity as `loadContext` last saved it. Read at a cold
 * start (before IS answers) and when a persona ends: while one is active, the
 * store holds the persona, and this record is the only place the admin's own
 * identity is kept (loadContext writes it; the overlay guard keeps memory).
 */
export async function readRememberedViewer(): Promise<RememberedViewer | null> {
  const cached = (await IndexedDBService.get('meta', VIEWER_KEY)) as StoredViewer | undefined;
  if (!cached) return null;
  // Erasmus is a semester, a faculty is a degree: an old Erasmus flag would
  // show ESN-only events to a student who is no longer one.
  const fresh = Date.now() - (cached.savedAt ?? 0) < ERASMUS_CACHE_MS;
  return {
    userFaculty: cached.faculty,
    userProgramme: cached.programme ?? null,
    isErasmus: fresh && cached.erasmus,
  };
}
