/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { getSmartWeekRange } from '../utils/calendar';
import { IndexedDBService } from '../services/storage';
import { syncService, outlookSyncService, syncGradeHistory } from '../services/sync';
import { useOutlookSync } from '../hooks/data';

import { useSpolkySettings } from './useSpolkySettings';
import { useAppStore, initializeStore } from '../store/useAppStore';
import { signalReady, requestData, isInIframe } from '../api/proxyClient';
import type { AppView, SelectedSubject } from '../types/app';
import { isContentMessage } from '../types/messages';

import { isDualLanguageStudyPlan } from '../types/studyPlan';
import type { DualLanguageStudyPlan } from '../types/studyPlan';
import type { BlockLesson } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SubjectsData, ParsedFile, SyllabusRequirements, SubjectAttendance } from '../types/documents';

interface SyncedData {
    schedule?: BlockLesson[];
    exams?: ExamSubject[];
    subjects?: SubjectsData;
    files?: Record<string, ParsedFile[] | { cz: ParsedFile[]; en: ParsedFile[] }>;
    syllabuses?: Record<string, SyllabusRequirements | { cz: SyllabusRequirements; en: SyllabusRequirements }>;
    classmates?: Record<string, unknown>;
    attendance?: Record<string, SubjectAttendance[]>;
    studyPlan?: DualLanguageStudyPlan;
    studyStats?: unknown;
    cvicneTests?: any[];
    odevzdavarny?: any[];
    lastSync?: string;
    isSyncing?: boolean;
    isPartial?: boolean;
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

    useEffect(() => {
        outlookSyncService.init();
        syncGradeHistory()
            .then(() => useAppStore.getState().loadStudyJamSuggestions())
            .catch(() => {});
        let unsub: (() => void) | undefined;
        initializeStore().then(unsubscribe => {
            unsub = unsubscribe;
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
            if (d.type === 'REIS_NAV_MENU') {
                useAppStore.getState().setNavPages(d.categories);
                useAppStore.getState().migratePinnedIds(d.categories);
                return;
            }

            const r = d.type === 'REIS_SYNC_UPDATE' ? (d.data as unknown as SyncedData) : (d.type === 'REIS_DATA' && d.dataType === 'all') ? (d.data as unknown as SyncedData) : null;
            if (!r) return;

            // Instantly update store for reactivity, then persist to IDB in background
            if (r.schedule && typeof r.isPartial === 'boolean') {
                useAppStore.getState().setSchedule(r.schedule as any, r.isPartial);
            }

            try {
                if (r.schedule) {
                    await IndexedDBService.set('schedule', 'current', r.schedule);
                    if (typeof r.isPartial === 'boolean') {
                        await IndexedDBService.set('meta', 'schedule_is_partial', r.isPartial);
                    }
                }


                if (r.studyPlan && isDualLanguageStudyPlan(r.studyPlan)) await IndexedDBService.set('study_plan', 'current', r.studyPlan);
                if (r.studyStats) await IndexedDBService.set('meta', 'study_stats', r.studyStats);
                if (r.cvicneTests) {
                    const userParams = await IndexedDBService.get('meta', 'reis_user_params');
                    if (userParams?.studium) {
                        await IndexedDBService.set('cvicne_tests', userParams.studium, r.cvicneTests);
                        useAppStore.getState().setCvicneTests(r.cvicneTests);
                    }
                }
                if (r.odevzdavarny) {
                    const userParams = await IndexedDBService.get('meta', 'reis_user_params');
                    if (userParams?.studium && userParams?.obdobi) {
                        await IndexedDBService.set('odevzdavarny', `${userParams.studium}_${userParams.obdobi}`, r.odevzdavarny);
                        useAppStore.getState().setOdevzdavarny(r.odevzdavarny);
                    }
                }
                if (r.exams) await IndexedDBService.set('exams', 'current', r.exams);

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

                if (r.assessments) {
                    await IndexedDBService.setMany(
                        'assessments',
                        Object.entries(r.assessments).map(([c, a]) => [c, a] as const)
                    );
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
                    await IndexedDBService.setMany(
                        'classmates',
                        Object.entries(r.classmates).map(([c, cl]) => [c, cl] as const)
                    );
                }

                if (r.lastSync) await IndexedDBService.set('meta', 'last_sync', r.lastSync);
            } catch {
                // IDB write failure is non-critical — store already has fresh data
            }

            if (typeof r.isSyncing === 'boolean') {
                useAppStore.getState().setSyncStatus({ isSyncing: r.isSyncing });
                if (!r.isSyncing) {
                    useAppStore.getState().fetchAllFiles();
                    useAppStore.getState().invalidateClassmates();
                    syncGradeHistory()
                        .then(() => useAppStore.getState().loadStudyJamSuggestions())
                        .catch(() => {});
                }
            }
            syncService.triggerRefresh();
        };
        window.addEventListener('message', handle);
        signalReady(); requestData('all');
        return () => window.removeEventListener('message', handle);
    }, []);

    const handleOpenSubjectFromSearch = (courseCode: string, courseName?: string, courseId?: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates') => {
        setSelectedSubject({ courseCode, courseName: courseName || courseCode, courseId: courseId || '', id: `search-${courseCode}`, isFromSearch: true, facultyCode, initialTab });
    };

    return { currentDate, setCurrentDate, currentView, setCurrentView, selectedSubject, setSelectedSubject, weekNavCount, setWeekNavCount, isFeedbackOpen, setIsFeedbackOpen, openSettingsRef, searchPrefillRef, outlookSyncEnabled, handleOpenSubjectFromSearch };
}
