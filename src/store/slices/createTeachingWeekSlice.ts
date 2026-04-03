import type { TeachingWeekSlice, AppSlice } from '../types';
import { fetchTeachingWeek } from '../../api/teachingWeek';

export const createTeachingWeekSlice: AppSlice<TeachingWeekSlice> = (set) => ({
    teachingWeek: null,
    fetchTeachingWeek: async () => {
        const data = await fetchTeachingWeek();
        set({ teachingWeek: data });
    },
});
