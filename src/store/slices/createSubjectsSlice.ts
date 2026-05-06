import type { SubjectsSlice, AppSlice, CourseDeadline } from '../types';
import type { SubjectAttendance } from '../../types/documents';
import { IndexedDBService } from '../../services/storage';
import { sendTelemetry } from '../../services/errorReporter/telemetry';

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
        } catch (e) {
            console.warn('[SubjectsSlice] fetchSubjects failed:', e);
            sendTelemetry('SubjectsSlice.fetchSubjects', e);
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
        IndexedDBService.set('meta', 'course_nicknames', newNicknames).catch(console.error);
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
        IndexedDBService.set('meta', 'course_deadlines', newDeadlines).catch(console.error);
    }
});
