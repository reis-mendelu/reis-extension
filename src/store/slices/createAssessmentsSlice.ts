import type { AssessmentsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createAssessmentsSlice: AppSlice<AssessmentsSlice> = (set, get) => ({
    assessments: {},
    assessmentsLoading: {},
    fetchAssessments: async (courseCode) => {
        if (!get().assessments[courseCode]) {
            set((state) => ({
                assessmentsLoading: { ...state.assessmentsLoading, [courseCode]: true }
            }));
        }

        try {
            const raw = await IndexedDBService.get('assessments', courseCode);
            const data = raw ? (Array.isArray(raw) ? raw : raw.cz || []) : [];
            set((state) => ({
                assessments: { ...state.assessments, [courseCode]: data },
                assessmentsLoading: { ...state.assessmentsLoading, [courseCode]: false }
            }));
        } catch (e) {
            console.warn('[AssessmentsSlice] fetchAssessments failed:', e);
            set((state) => ({
                assessmentsLoading: { ...state.assessmentsLoading, [courseCode]: false }
            }));
        }
    },
});
