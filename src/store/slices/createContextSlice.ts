import type { ContextSlice, AppSlice } from '../types';
import { getUserParams } from '../../utils/userParams';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

/** Who the student was last time IS said so — the event audience's fallback. */
const VIEWER_KEY = 'viewer_audience';

export const createContextSlice: AppSlice<ContextSlice> = (set, get) => ({
  studiumId: null,
  studentId: null,
  obdobiId: null,
  facultyId: null,
  userFaculty: null,
  userSemester: null,
  isErasmus: false,
  fullName: null,
  userEmail: null,
  contextResolved: false,
  loadContext: async () => {
    // getUserParams reads IS, which demo mode blocks. Returning early rather
    // than letting it throw: the rejection surfaced a toast nobody asked for,
    // and enterDemo has already set a fabricated context this would have no
    // way to restore. Same shape as trackDailyUsage's guard.
    if (get().demoMode) return;

    try {
      // Cold start on Capacitor: getUserParams can lose the race with session
      // restore and return nothing, which would leave the event audience
      // unknown (public events only) for the whole session. Follows used to be
      // persisted, which hid this; the remembered audience replaces them. An
      // identity switch wipes IndexedDB (watchSignedInStudent), so this is
      // never another student's.
      if (get().userFaculty === null) {
        const cached = (await IndexedDBService.get('meta', VIEWER_KEY)) as
          { faculty: string | null; erasmus: boolean } | undefined;
        if (cached && get().userFaculty === null) {
          set({ userFaculty: cached.faculty, isErasmus: cached.erasmus });
        }
      }

      const params = await getUserParams();
      if (params) {
        set({
          studiumId: params.studium ? String(params.studium) : null,
          studentId: params.studentId ? String(params.studentId) : null,
          obdobiId: params.obdobi ? String(params.obdobi) : null,
          facultyId: params.facultyId ? String(params.facultyId) : null,
          // An unparsed header (#titulek) must not erase a faculty already known.
          userFaculty: params.facultyLabel ?? get().userFaculty,
          userSemester: params.periodLabel ?? null,
          isErasmus: params.isErasmus,
          fullName: params.fullName ?? null,
          userEmail: params.email ?? null,
          // Answered by IS this session: later re-asks (sync, resume) are free.
          ...(params.facultyLabel ? { contextResolved: true } : {}),
        });
        if (params.facultyLabel) {
          await IndexedDBService.set('meta', VIEWER_KEY, {
            faculty: params.facultyLabel,
            erasmus: params.isErasmus,
          });
        }
      }
    } catch (err) {
      logError('ContextSlice.loadContext', err);
    }
  },
});
