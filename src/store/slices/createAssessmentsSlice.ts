import type { AssessmentsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createAssessmentsSlice: AppSlice<AssessmentsSlice> = (set) => ({
    assessments: {},
    assessmentsLoading: {},
    fetchAssessments: async (courseCode) => {
        set((state) => ({
            assessmentsLoading: { ...state.assessmentsLoading, [courseCode]: true }
        }));

        try {
            const raw = await IndexedDBService.get('assessments', courseCode);
            console.log(`[assessmentsSlice] IDB read assessments/${courseCode}:`, raw);
            const data = raw ? (Array.isArray(raw) ? raw : raw.cz || []) : [];
            set((state) => ({
                assessments: { ...state.assessments, [courseCode]: data },
                assessmentsLoading: { ...state.assessmentsLoading, [courseCode]: false }
            }));
        } catch {
            set((state) => ({
                assessmentsLoading: { ...state.assessmentsLoading, [courseCode]: false }
            }));
        }
    },
});
