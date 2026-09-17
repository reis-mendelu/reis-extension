import type { SubjectsSlice, AppSlice, CourseDeadline } from '../types';
import type { SubjectAttendance } from '../../types/documents';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

export const createSubjectsSlice: AppSlice<SubjectsSlice> = (set, get) => ({
    subjects: null,
    subjectsLoading: false,
    courseNicknames: {},
    courseDeadlines: {},
    attendance: {},
    pastAttendance: {},
    fetchSubjects: async () => {
        // Only show loading on the first call. Subsequent sync-driven refreshes
        // must not flip isLoaded and cause a UI flash while cached data is visible.
        if (get().subjects === null) set({ subjectsLoading: true });
        try {
            const [data, nicknames, deadlines, attendance] = await Promise.all([
                IndexedDBService.get('subjects', 'current'),
                IndexedDBService.get('meta', 'course_nicknames'),
                IndexedDBService.get('meta', 'course_deadlines'),
                IndexedDBService.get('meta', 'current_attendance'),
            ]);
            set({
                subjects: data || null,
                courseNicknames: (nicknames as Record<string, string>) || {},
                courseDeadlines: (deadlines as Record<string, CourseDeadline[]>) || {},
                attendance: (attendance as Record<string, SubjectAttendance[]>) || {},
                subjectsLoading: false,
            });

            // The failure rates for the subjects just loaded, started HERE as
            // well as from `fetchStudyPlan`. Each subject is its own file on the
            // CDN, so the wait is proportional to how late the first request
            // goes out — and the plan was the only trigger, which on a first run
            // means after a full sync has written it. The subjects arrive
            // earlier and are what the screen is listing.
            //
            // `fetchSuccessRateBatch` skips codes it already has or already has
            // in flight, so overlapping with the plan's call costs nothing.
            //
            // Not awaited, rejection swallowed: the rates are a chip on a row,
            // and the subject list is the screen. A CDN outage must not cost a
            // student their subjects.
            const codes = Object.keys(
                (data as { data?: Record<string, unknown> } | null)?.data ?? {}
            );
            if (codes.length > 0)
                void get()
                    .fetchSuccessRateBatch(codes)
                    .catch(() => {});
        } catch (e) {
            logError('SubjectsSlice.fetchSubjects', e);
            set({ subjectsLoading: false });
        }
    },
    setAttendance: (data) => {
        set({ attendance: data });
        IndexedDBService.set('meta', 'current_attendance', data).catch(() => {});
    },
    setPastAttendance: (data) => set({ pastAttendance: data }),
    setCourseNickname: (courseCode, nickname) => {
        const currentNicknames = get().courseNicknames;
        const newNicknames = { ...currentNicknames };

        if (nickname === null || nickname.trim() === '') {
            delete newNicknames[courseCode];
        } else {
            newNicknames[courseCode] = nickname.trim();
        }

        set({ courseNicknames: newNicknames });
        IndexedDBService.set('meta', 'course_nicknames', newNicknames).catch(e => logError('SubjectsSlice.setCourseNickname', e));
    },
    setCourseDeadlines: (courseCode, deadlines) => {
        const currentDeadlines = get().courseDeadlines;
        const newDeadlines = { ...currentDeadlines };

        if (!deadlines || deadlines.length === 0) {
            delete newDeadlines[courseCode];
        } else {
            newDeadlines[courseCode] = deadlines;
        }

        set({ courseDeadlines: newDeadlines });
        IndexedDBService.set('meta', 'course_deadlines', newDeadlines).catch(e => logError('SubjectsSlice.setCourseDeadlines', e));
    }
});
