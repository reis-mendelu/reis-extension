import type { ContextSlice, AppSlice } from '../types';
import { getUserParams } from '../../utils/userParams';

export const createContextSlice: AppSlice<ContextSlice> = (set) => ({
    studiumId: null,
    studentId: null,
    obdobiId: null,
    facultyId: null,
    userFaculty: null,
    userSemester: null,
    isErasmus: false,
    fullName: null,
    loadContext: async () => {
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
                });
            }
        } catch (err) {
            console.error("Failed to load user context", err);
        }
    },
});
