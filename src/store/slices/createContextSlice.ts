import type { ContextSlice, AppSlice } from '../types';
import { getUserParams } from '../../utils/userParams';
import { logError } from '../../utils/reportError';

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
  loadContext: async () => {
    // getUserParams reads IS, which demo mode blocks. Returning early rather
    // than letting it throw: the rejection surfaced a toast nobody asked for,
    // and enterDemo has already set a fabricated context this would have no
    // way to restore. Same shape as trackDailyUsage's guard.
    if (get().demoMode) return;

    try {
      const params = await getUserParams();
      if (params) {
        set({
          studiumId: params.studium ? String(params.studium) : null,
          studentId: params.studentId ? String(params.studentId) : null,
          obdobiId: params.obdobi ? String(params.obdobi) : null,
          facultyId: params.facultyId ? String(params.facultyId) : null,
          userFaculty: params.facultyLabel ?? null,
          userSemester: params.periodLabel ?? null,
          isErasmus: params.isErasmus,
          fullName: params.fullName ?? null,
          userEmail: params.email ?? null,
        });
        // The student's own Going/Interested can only be read back once their
        // id is known, and loadContext races loadMapEvents rather than
        // preceding it. Re-asking here costs one RPC and is what stops a
        // student's own answer from vanishing on every reload; the counts
        // themselves were already correct without it.
        const events = get().mapEvents;
        if (events.length > 0) void get().loadRsvps(events.map((e) => e.id));
      }
    } catch (err) {
      logError('ContextSlice.loadContext', err);
    }
  },
});
