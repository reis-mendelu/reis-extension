import type { SubjectsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createSubjectsSlice: AppSlice<SubjectsSlice> = (set, get) => ({
    subjects: null,
    subjectsLoading: false,
    courseNicknames: {},
    fetchSubjects: async () => {
        set({ subjectsLoading: true });
        try {
            const [data, nicknames] = await Promise.all([
                IndexedDBService.get('subjects', 'current'),
                IndexedDBService.get('meta', 'course_nicknames')
            ]);
            set({ 
                subjects: data || null,
                courseNicknames: (nicknames as Record<string, string>) || {},
                subjectsLoading: false 
            });
        } catch {
            set({ subjectsLoading: false });
        }
    },
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
    }
});
