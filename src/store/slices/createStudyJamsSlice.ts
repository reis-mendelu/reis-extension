import type { AppSlice, StudyJamsSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { fetchKillerCourses, registerAvailability, deleteAvailability, fetchMyTutoringMatch } from '../../api/studyJams';
import { checkStudyJamEligibility } from '../../services/studyJams/studyJamEligibility';
import { getUserParams } from '../../utils/userParams';

const OPT_INS_KEY = 'study_jam_optins';

export const createStudyJamsSlice: AppSlice<StudyJamsSlice> = (set, get) => ({
    isStudyJamOpen: false,
    setIsStudyJamOpen: (isOpen) => set({ isStudyJamOpen: isOpen }),
    isSelectingTime: false,
    setIsSelectingTime: (isSelecting) => set({ isSelectingTime: isSelecting }),
    pendingTimeSelection: null,
    setPendingTimeSelection: (selection) => set({ pendingTimeSelection: selection }),
    studyJamSuggestions: [],
    studyJamOptIns: {},
    studyJamMatch: null,
    selectedStudyJamSuggestion: null,
    setSelectedStudyJamSuggestion: (suggestion) => set({ selectedStudyJamSuggestion: suggestion }),

    loadStudyJamSuggestions: async () => {
        try {
            const userParams = await getUserParams();
            const [killerCourses, storedOptIns] = await Promise.all([
                fetchKillerCourses(),
                IndexedDBService.get('meta', OPT_INS_KEY) as Promise<StudyJamsSlice['studyJamOptIns'] | null>,
            ]);
            const optIns = storedOptIns ?? {};

            if (userParams) {
                const existingMatch = await fetchMyTutoringMatch(userParams.studium, userParams.obdobi);
                if (existingMatch) {
                    const myRole = existingMatch.tutor_studium === userParams.studium ? 'tutor' : 'tutee';
                    const otherPartyStudium = myRole === 'tutor' ? existingMatch.tutee_studium : existingMatch.tutor_studium;
                    const killerCourse = killerCourses.find(kc => kc.course_code === existingMatch.course_code);
                    const courseName = killerCourse?.course_name ?? existingMatch.course_code;
                    set({
                        studyJamMatch: { courseCode: existingMatch.course_code, courseName, otherPartyStudium, myRole },
                        studyJamOptIns: optIns,
                        studyJamSuggestions: [],
                    });
                    return;
                }
            }

            const suggestions = await checkStudyJamEligibility(killerCourses);
            const filtered = suggestions.filter(s => !optIns[s.courseCode]);
            set({ studyJamSuggestions: filtered, studyJamOptIns: optIns });
        } catch (e) {
            console.error('[StudyJamsSlice] loadStudyJamSuggestions error', e);
        }
    },

    optInStudyJam: async (courseCode, _courseName, role) => {
        const userParams = await getUserParams();
        if (!userParams) return;
        const id = await registerAvailability(userParams.studium, courseCode, role, userParams.obdobi);
        if (!id) return;
        const optIns = { ...get().studyJamOptIns, [courseCode]: { id, role } };
        await IndexedDBService.set('meta', OPT_INS_KEY, optIns);
        set(state => ({
            studyJamOptIns: optIns,
            studyJamSuggestions: state.studyJamSuggestions.filter(s => s.courseCode !== courseCode),
        }));
    },


    cancelOptIn: async (courseCode) => {
        const optIn = get().studyJamOptIns[courseCode];
        if (!optIn) return;
        await deleteAvailability(optIn.id);
        const optIns = { ...get().studyJamOptIns };
        delete optIns[courseCode];
        await IndexedDBService.set('meta', OPT_INS_KEY, optIns);
        set({ studyJamOptIns: optIns });
    },

    dismissStudyJamMatch: () => {
        set({ studyJamMatch: null });
    },
});
