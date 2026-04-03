import type { TeachingWeekSlice, AppSlice } from '../types';
import { fetchTeachingWeeks } from '../../api/teachingWeek';

export const createTeachingWeekSlice: AppSlice<TeachingWeekSlice> = (set) => ({
    teachingWeekData: null,
    fetchTeachingWeek: async () => {
        const data = await fetchTeachingWeeks();
        set({ teachingWeekData: data });
    },
});
