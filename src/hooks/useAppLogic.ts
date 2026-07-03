/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { getSmartWeekRange } from '../utils/calendar';
import { IndexedDBService } from '../services/storage';
import { syncService, outlookSyncService, syncGradeHistory } from '../services/sync';
import { useOutlookSync } from '../hooks/data';

import { useSpolkySettings } from './useSpolkySettings';
import { useAppStore, initializeStore } from '../store/useAppStore';
import { NOTES_ENABLED } from '../config/featureFlags';
import { signalReady, requestData, isInIframe } from '../api/proxyClient';
import type { AppView, SelectedSubject } from '../types/app';
import { isContentMessage } from '../types/messages';
import { sendTelemetry } from '../services/errorReporter/telemetry';
import { logError } from '../utils/reportError';

import { isDualLanguageStudyPlan } from '../types/studyPlan';
import type { DualLanguageStudyPlan, StudyStats, StudyComparison } from '../types/studyPlan';
import type { BlockLesson } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SubjectsData, ParsedFile, SyllabusRequirements, SubjectAttendance } from '../types/documents';
import type { ClassmatesData } from '../types/classmates';
import type { SubjectZaznamnik } from '../types/zaznamnik';

interface SyncedData {
    schedule?: BlockLesson[];
    exams?: ExamSubject[];
    subjects?: SubjectsData;
    files?: Record<string, ParsedFile[] | { cz: ParsedFile[]; en: ParsedFile[] }>;
    syllabuses?: Record<string, SyllabusRequirements | { cz: SyllabusRequirements; en: SyllabusRequirements }>;
    classmates?: Record<string, ClassmatesData>;
    zaznamnik?: Record<string, SubjectZaznamnik | null>;
    attendance?: Record<string, SubjectAttendance[]>;
    pastAttendance?: Record<string, SubjectAttendance[]>;
    studyPlan?: DualLanguageStudyPlan;
    studyStats?: unknown;
    studyComparison?: unknown;
    cvicneTests?: any[];
    odevzdavarny?: any[];
    lastSync?: string;
    isSyncing?: boolean;
}



export function useAppLogic() {
    const [currentDate, setCurrentDate] = useState<Date>(() => getSmartWeekRange().start);
    const [currentView, setCurrentView] = useState<AppView>('calendar');
    const [selectedSubject, setSelectedSubject] = useState<SelectedSubject | null>(null);
    const [weekNavCount, setWeekNavCount] = useState(0);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const openSettingsRef = useRef<(() => void) | null>(null);
    const searchPrefillRef = useRef<((query: string) => void) | null>(null);
    const { isEnabled: outlookSyncEnabled } = useOutlookSync();
    useSpolkySettings();

    // Deep-link bridge: switch to the map view when something requests a room
    // focus (e.g. "Show on map" buttons). Subscribe imperatively so the view
    // switch fires in the store callback (outside React's render cycle) and
    // only on an actual bump of the counter — never on initial mount.
    useEffect(() => {
        return useAppStore.subscribe((state, prev) => {
            if (state.mapFocusRequest !== prev.mapFocusRequest) setCurrentView('map');
        });
    }, []);

    useEffect(() => {
        outlookSyncService.init();
        syncGradeHistory()
            .then(() => { useAppStore.getState().loadStudyJamSuggestions(); useAppStore.getState().loadGradeHistory(); })
            .catch(() => {});

        // Hydrate past attendance from iframe-side IDB cache
        IndexedDBService.get('meta', 'past_attendance_merged').then(data => {
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                useAppStore.getState().setPastAttendance(data as Record<string, SubjectAttendance[]>);
            }
        }).catch(e => logError('useAppLogic.hydratePastAttendance', e));

        let unsub: (() => void) | undefined;
        initializeStore().then(unsubscribe => {
            unsub = unsubscribe;
            // Back up any existing notes once on startup (one-way mirror to Drive).
            if (NOTES_ENABLED) void useAppStore.getState().pushNotesSnapshot();
        });
        return () => { unsub?.(); };
    }, []);

    const isInitialLoad = useRef(true);
    useEffect(() => {
        Promise.all([
            IndexedDBService.get('meta', 'reis_current_week'),
            IndexedDBService.get('meta', 'reis_current_view')
        ]).then(([w, v]) => {
            if (w) setCurrentDate(new Date(w as string));
            if (v) setCurrentView(v as AppView);
            setTimeout(() => { isInitialLoad.current = false; }, 50);
        });
    }, []);

    useEffect(() => { if (!isInitialLoad.current) IndexedDBService.set('meta', 'reis_current_week', currentDate.toISOString()); }, [currentDate]);
    useEffect(() => { if (!isInitialLoad.current) IndexedDBService.set('meta', 'reis_current_view', currentView); }, [currentView]);

    useEffect(() => {
        // Skip iframe data sync when using mock data
        if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return;

        if (!isInIframe()) return;
        const handle = async (e: MessageEvent) => {
            if (e.source !== window.parent) return;
            const d = e.data;
            if (!isContentMessage(d)) return;
            if (d.type === 'REIS_POPUP_STATE') return;
            if (d.type === 'REIS_TELEMETRY_ERROR') {
                sendTelemetry(d.context, new Error(d.message));
                return;
            }
            if (d.type === 'REIS_NAV_MENU') {
                useAppStore.getState().setNavPages(d.categories);
                return;
            }

            const r = d.type === 'REIS_SYNC_UPDATE' ? (d.data as unknown as SyncedData) : (d.type === 'REIS_DATA' && d.dataType === 'all') ? (d.data as unknown as SyncedData) : null;
            if (!r) return;

            // Instantly update store for reactivity, then persist to IDB in background
            if (r.schedule) {
                useAppStore.getState().setSchedule(r.schedule as any);
            }

            try {
                if (r.schedule) {
                    await IndexedDBService.set('schedule', 'current', r.schedule);
                }


                if (r.studyPlan && isDualLanguageStudyPlan(r.studyPlan)) await IndexedDBService.set('study_plan', 'current', r.studyPlan);
                if (r.studyStats) {
                    useAppStore.getState().setStudyStats(r.studyStats as StudyStats);
                    await IndexedDBService.set('meta', 'study_stats', r.studyStats);
                }
                if (r.studyComparison) {
                    useAppStore.getState().setStudyComparison(r.studyComparison as StudyComparison);
                    await IndexedDBService.set('meta', 'study_comparison', r.studyComparison);
                }
                if (r.cvicneTests?.length) {
                    const userParams = await IndexedDBService.get('meta', 'reis_user_params');
                    if (userParams?.studium) {
                        await IndexedDBService.set('cvicne_tests', userParams.studium, r.cvicneTests);
                        useAppStore.getState().setCvicneTests(r.cvicneTests);
                    }
                }
                if (r.odevzdavarny?.length) {
                    const userParams = await IndexedDBService.get('meta', 'reis_user_params');
                    if (userParams?.studium && userParams?.obdobi) {
                        await IndexedDBService.set('odevzdavarny', `${userParams.studium}_${userParams.obdobi}`, r.odevzdavarny);
                        useAppStore.getState().setOdevzdavarny(r.odevzdavarny);
                    }
                }
                if (r.exams) useAppStore.getState().setExams(r.exams);

                if (r.subjects?.data) {
                    const existing = await IndexedDBService.get('subjects', 'current') as { data: Record<string, { nameCs?: string; nameEn?: string }> } | null;
                    if (existing?.data) {
                        Object.keys(r.subjects.data).forEach(code => {
                            const incomingSub = r.subjects!.data[code];
                            const existingSub = existing.data[code];
                            if (existingSub) {
                                if (!incomingSub.nameCs && existingSub.nameCs) incomingSub.nameCs = existingSub.nameCs;
                                if (!incomingSub.nameEn && existingSub.nameEn) incomingSub.nameEn = existingSub.nameEn;
                            }
                        });
                    }
                    await IndexedDBService.set('subjects', 'current', r.subjects);
                }

                if (r.attendance) {
                    useAppStore.getState().setAttendance(r.attendance);
                }

                if (r.pastAttendance) {
                    useAppStore.getState().setPastAttendance(r.pastAttendance);
                    await IndexedDBService.set('meta', 'past_attendance_merged', r.pastAttendance);
                }

                if (r.files) {
                    const fileEntries = Object.entries(r.files);
                    const existingFiles = await Promise.all(
                        fileEntries.map(([c]) => IndexedDBService.get('files', c))
                    );
                    const toWrite = fileEntries
                        .map(([c, f], i) => {
                            const existing = existingFiles[i];
                            if (!existing || (f as Record<string, unknown>).cz || !(existing as Record<string, unknown>).cz) {
                                return [c, f] as const;
                            }
                            return null;
                        })
                        .filter((e): e is readonly [string, ParsedFile[] | { cz: ParsedFile[]; en: ParsedFile[] }] => e !== null);
                    await IndexedDBService.setMany('files', toWrite);
                }

                if (r.syllabuses) {
                    const sylEntries = Object.entries(r.syllabuses);
                    const existingSyl = await Promise.all(
                        sylEntries.map(([c]) => IndexedDBService.get('syllabuses', c))
                    );
                    const toWrite = sylEntries
                        .map(([c, s], i) => {
                            const existing = existingSyl[i];
                            if (!existing || (s as Record<string, unknown>).cz || !(existing as Record<string, unknown>).cz) {
                                return [c, s] as const;
                            }
                            return null;
                        })
                        .filter((e): e is readonly [string, SyllabusRequirements | { cz: SyllabusRequirements; en: SyllabusRequirements }] => e !== null);
                    await IndexedDBService.setMany('syllabuses', toWrite);
                }

                if (r.classmates) {
                    // Must await: fetchAllClassmates() reads the same IDB store.
                    await IndexedDBService.setMany(
                        'classmates',
                        Object.entries(r.classmates).map(([c, cl]) => [c, cl] as const)
                    );
                }

                if (r.zaznamnik) {
                    useAppStore.getState().setZaznamnikBatch(r.zaznamnik);
                    const persistEntries = Object.entries(r.zaznamnik).filter(([, v]) =>
                        v && (v.ph.sections.length > 0 || v.vt.tests.length > 0)
                    );
                    if (persistEntries.length > 0) {
                        await IndexedDBService.setMany('zaznamnik', persistEntries);
                    }
                }

                if (r.lastSync) await IndexedDBService.set('meta', 'last_sync', r.lastSync);
            } catch {
                // IDB write failure is non-critical — store already has fresh data
            }

            if (typeof r.isSyncing === 'boolean') {
                useAppStore.getState().setSyncStatus({ isSyncing: r.isSyncing });
                if (!r.isSyncing) {
                    useAppStore.getState().fetchAllFiles();
                    useAppStore.getState().fetchAllClassmates();
                    useAppStore.getState().fetchAllExamClassmates();
                    syncGradeHistory()
                        .then(() => { useAppStore.getState().loadStudyJamSuggestions(); useAppStore.getState().loadGradeHistory(); })
                        .catch(() => {});
                    syncService.triggerRefresh();
                }
            }
        };
        window.addEventListener('message', handle);
        signalReady(); requestData('all');
        return () => window.removeEventListener('message', handle);
    }, []);

    const handleOpenSubjectFromSearch = (courseCode: string, courseName?: string, courseId?: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik', isFulfilled?: boolean) => {
        setSelectedSubject({ courseCode, courseName: courseName || courseCode, courseId: courseId || '', id: `search-${courseCode}`, isFromSearch: true, facultyCode, initialTab, isFulfilled });
    };

    return { currentDate, setCurrentDate, currentView, setCurrentView, selectedSubject, setSelectedSubject, weekNavCount, setWeekNavCount, isFeedbackOpen, setIsFeedbackOpen, openSettingsRef, searchPrefillRef, outlookSyncEnabled, handleOpenSubjectFromSearch };
}
