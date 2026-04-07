import type { SubjectsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createSubjectsSlice: AppSlice<SubjectsSlice> = (set, get) => ({
    subjects: null,
    subjectsLoading: false,
    courseNicknames: {},
    courseDeadlines: {},
    attendance: {},
    fetchSubjects: async () => {
        // Only show loading on the first call. Subsequent sync-driven refreshes
        // must not flip isLoaded and cause a UI flash while cached data is visible.
        if (get().subjects === null) set({ subjectsLoading: true });
        try {
            const [data, nicknames, deadlines] = await Promise.all([
                IndexedDBService.get('subjects', 'current'),
                IndexedDBService.get('meta', 'course_nicknames'),
                IndexedDBService.get('meta', 'course_deadlines')
            ]);
            set({ 
                subjects: data || null,
                courseNicknames: (nicknames as Record<string, string>) || {},
                courseDeadlines: (deadlines as Record<string, any[]>) || {},
                subjectsLoading: false 
            });
        } catch {
            set({ subjectsLoading: false });
        }
    },
    setAttendance: (data) => set({ attendance: data }),
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
