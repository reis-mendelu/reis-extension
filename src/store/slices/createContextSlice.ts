import type { ContextSlice, AppSlice } from '../types';
import { getUserParams, isIdentityConfirmed } from '../../utils/userParams';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { baseProgramme } from '../../utils/partnerAudience';

/** Who the student was last time IS said so — the event audience's fallback. */
const VIEWER_KEY = 'viewer_audience';
/** How long a remembered Erasmus status is trusted without IS confirming it. */
const ERASMUS_CACHE_MS = 120 * 24 * 60 * 60 * 1000;

export const createContextSlice: AppSlice<ContextSlice> = (set, get) => ({
  studiumId: null,
  studentId: null,
  obdobiId: null,
  facultyId: null,
  userFaculty: null,
  userProgramme: null,
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

    // Cold start on Capacitor: getUserParams can lose the race with session
    // restore and return nothing, which would leave the event audience
    // unknown (public events only) for the whole session. Follows used to be
    // persisted, which hid this; the remembered audience replaces them. An
    // identity switch wipes IndexedDB (watchSignedInStudent), so this is never
    // another student's. Its own try: a failed cache read must not stop the
    // IS read below.
    try {
      if (get().userFaculty === null) {
        const cached = (await IndexedDBService.get('meta', VIEWER_KEY)) as
          | {
              faculty: string | null;
              erasmus: boolean;
              programme?: string | null;
              savedAt?: number;
            }
          | undefined;
        if (cached && get().userFaculty === null) {
          // Erasmus is a semester, a faculty is a degree: an old Erasmus flag
          // would show ESN-only events to a student who is no longer one.
          const fresh = Date.now() - (cached.savedAt ?? 0) < ERASMUS_CACHE_MS;
          set({
            userFaculty: cached.faculty,
            userProgramme: cached.programme ?? null,
            isErasmus: fresh && cached.erasmus,
          });
        }
      }
    } catch (err) {
      logError('ContextSlice.loadContext.cache', err);
    }

    try {
      const params = await getUserParams();
      if (params) {
        set({
          studiumId: params.studium ? String(params.studium) : null,
          studentId: params.studentId ? String(params.studentId) : null,
          obdobiId: params.obdobi ? String(params.obdobi) : null,
          facultyId: params.facultyId ? String(params.facultyId) : null,
          // An unparsed header (#titulek) must not erase a faculty already known.
          userFaculty: params.facultyLabel ?? get().userFaculty,
          // A remembered programme only stands in for the SAME faculty: kept
          // across a faculty change it would match another study's partner.
          userProgramme:
            baseProgramme(params.studyProgram) ??
            (params.facultyLabel === get().userFaculty || !params.facultyLabel
              ? get().userProgramme
              : null),
          userSemester: params.periodLabel ?? null,
          isErasmus: params.isErasmus,
          fullName: params.fullName ?? null,
          userEmail: params.email ?? null,
          // Answered by IS this session (not a persisted record from an earlier
          // one): later re-asks (sync, resume) are free.
          ...(params.facultyLabel && isIdentityConfirmed() ? { contextResolved: true } : {}),
        });
        if (params.facultyLabel) {
          await IndexedDBService.set('meta', VIEWER_KEY, {
            faculty: params.facultyLabel,
            erasmus: params.isErasmus,
            programme: baseProgramme(params.studyProgram),
            savedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      logError('ContextSlice.loadContext', err);
    }
  },
});
