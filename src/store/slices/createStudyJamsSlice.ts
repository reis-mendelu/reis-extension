import type { AppSlice, StudyJamsSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { fetchKillerCourses, registerAvailability, deleteAvailability, fetchMyTutoringMatch, fetchMyAvailability } from '../../api/studyJams';
import { checkStudyJamEligibility } from '../../services/studyJams/studyJamEligibility';
import { getUserParams } from '../../utils/userParams';

const OPT_INS_KEY = 'study_jam_optins';

// Guard against concurrent calls: if a load is already in-flight, subsequent
// callers share the same promise instead of each running their own copy (which
// would race on stale IDB reads before the first call flushes the writes).
let _loadInFlight: Promise<void> | null = null;

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

    loadStudyJamSuggestions: () => {
        if (_loadInFlight) {
            console.debug('[StudyJamsSlice] loadStudyJamSuggestions already in-flight, skipping duplicate call');
            return _loadInFlight;
        }
        _loadInFlight = (async () => {
            try {
                const userParams = await getUserParams();
                const [killerCourses, storedOptIns] = await Promise.all([
                    fetchKillerCourses(),
                    IndexedDBService.get('meta', OPT_INS_KEY) as Promise<StudyJamsSlice['studyJamOptIns'] | null>,
                ]);
                const optIns = storedOptIns ?? {};

                // Reconcile: ensure local opt-ins match the server exactly
                if (userParams) {
                    const serverAvail = await fetchMyAvailability(userParams.studentId);
                    console.debug('[StudyJamsSlice] Server availability records found:', serverAvail.length);
                    
                    const serverCodes = new Set(serverAvail.map(a => a.course_code));
                    let changed = false;

                    // 1. Add missing opt-ins from the server to local cache
                    for (const avail of serverAvail) {
                        if (!optIns[avail.course_code]) {
                            optIns[avail.course_code] = { role: avail.role };
                            changed = true;
                        }
                    }

                    // 2. Remove local opt-ins that no longer exist on the server
                    for (const code of Object.keys(optIns)) {
                        if (!serverCodes.has(code)) {
                            delete optIns[code];
                            changed = true;
                        }
                    }

                    if (changed) {
                        await IndexedDBService.set('meta', OPT_INS_KEY, optIns);
                    }
                }

                let matchCourseCode: string | null = null;
                if (userParams) {
                    const existingMatch = await fetchMyTutoringMatch(userParams.studentId, userParams.obdobi);
                    if (existingMatch) {
                        const myRole = existingMatch.tutor_student_id === userParams.studentId ? 'tutor' : 'tutee';
                        const otherPartyStudentId = myRole === 'tutor' ? existingMatch.tutee_student_id : existingMatch.tutor_student_id;
                        const killerCourse = killerCourses.find(kc => kc.course_code === existingMatch.course_code);
                        const courseName = killerCourse?.course_name ?? existingMatch.course_code;
                        matchCourseCode = existingMatch.course_code;
                        set({
                            studyJamMatch: { courseCode: existingMatch.course_code, courseName, otherPartyStudentId, myRole },
                            studyJamOptIns: optIns,
                        });
                    } else {
                        set({ studyJamMatch: null });
                    }
                }

                const suggestions = await checkStudyJamEligibility(killerCourses);
                
                // Filter out any courses they've opted into, or that they are already matched for
                const filtered = suggestions.filter(s => {
                    const isOptedIn = !!optIns[s.courseCode];
                    const isMatched = s.courseCode === matchCourseCode;
                    if (isOptedIn || isMatched) {
                        console.debug(`[StudyJamsSlice] Filtering out ${s.courseCode}: isOptedIn=${isOptedIn}, isMatched=${isMatched}`);
                        return false;
                    }
                    return true;
                });
                
                console.debug(`[StudyJamsSlice] Final UI suggestions:`, filtered);

                set({ studyJamSuggestions: filtered, studyJamOptIns: optIns });
            } catch (e) {
                console.error('[StudyJamsSlice] loadStudyJamSuggestions error', e);
            } finally {
                _loadInFlight = null;
            }
        })();
        return _loadInFlight;
    },

    optInStudyJam: async (courseCode, _courseName, role) => {
        const userParams = await getUserParams();
        if (!userParams) return;
        const ok = await registerAvailability(userParams.studentId, courseCode, role, userParams.obdobi);
        if (!ok) return;
        const optIns = { ...get().studyJamOptIns, [courseCode]: { role } };
        await IndexedDBService.set('meta', OPT_INS_KEY, optIns);
        set(state => ({
            studyJamOptIns: optIns,
            studyJamSuggestions: state.studyJamSuggestions.filter(s => s.courseCode !== courseCode),
        }));
    },

    cancelOptIn: async (courseCode) => {
        const optIn = get().studyJamOptIns[courseCode];
        if (!optIn) return;
        const userParams = await getUserParams();
        if (!userParams) return;
        await deleteAvailability(userParams.studentId, courseCode);
        const optIns = { ...get().studyJamOptIns };
        delete optIns[courseCode];
        await IndexedDBService.set('meta', OPT_INS_KEY, optIns);
        set({ studyJamOptIns: optIns });
    },

    dismissStudyJamMatch: () => {
        set({ studyJamMatch: null });
    },
});
