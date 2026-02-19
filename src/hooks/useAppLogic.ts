import { useState, useEffect, useRef } from 'react';
import { getSmartWeekRange } from '../utils/calendar';
import { IndexedDBService } from '../services/storage';
import { syncService, outlookSyncService, syncGradeHistory } from '../services/sync';
import { useOutlookSync } from '../hooks/data';
import { fetchTutorials } from '../services/tutorials';
import type { Tutorial } from '../services/tutorials';
import { useSpolkySettings } from './useSpolkySettings';
import { useAppStore, initializeStore } from '../store/useAppStore';
import { signalReady, requestData, isInIframe } from '../api/proxyClient';
import type { AppView, SelectedSubject } from '../types/app';
import { isContentMessage } from '../types/messages';
import type { ClassmatesData } from '../types/classmates';

interface SyncedData {
  schedule?: unknown;
  exams?: unknown;
  subjects?: { data: Record<string, { nameCs?: string; nameEn?: string }> };
  files?: Record<string, unknown>;
  syllabuses?: Record<string, unknown>;
  classmates?: Record<string, unknown>;
  lastSync?: string;
  isSyncing?: boolean;
  isPartial?: boolean;
}


export function useAppLogic() {
  const [currentDate, setCurrentDate] = useState<Date>(() => getSmartWeekRange().start);
  const [currentView, setCurrentView] = useState<AppView>('calendar');
  const [selectedSubject, setSelectedSubject] = useState<SelectedSubject | null>(null);
  const [weekNavCount, setWeekNavCount] = useState(0);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const openSettingsRef = useRef<(() => void) | null>(null);
  const { isEnabled: outlookSyncEnabled } = useOutlookSync();
  const { subscribedAssociations } = useSpolkySettings();

  useEffect(() => {
    outlookSyncService.init();
    syncGradeHistory().catch(e => console.warn('[useAppLogic] grade history sync failed:', e));
    let unsub: (() => void) | undefined;
    initializeStore().then(unsubscribe => {
      unsub = unsubscribe;
    });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => {
    IndexedDBService.get('meta', 'reis_current_week').then(s => s && setCurrentDate(new Date(s as string)));
    IndexedDBService.get('meta', 'reis_current_view').then(s => s && setCurrentView(s as AppView));
  }, []);

  useEffect(() => { IndexedDBService.set('meta', 'reis_current_week', currentDate.toISOString()); }, [currentDate]);
  useEffect(() => { IndexedDBService.set('meta', 'reis_current_view', currentView); }, [currentView]);

  useEffect(() => {
    fetchTutorials(subscribedAssociations).then(setTutorials).catch(e => console.error(e));
  }, [subscribedAssociations]);

  useEffect(() => {
    // Skip iframe data sync when using mock data
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
      console.log('[App] Mock data enabled - skipping iframe data sync');
      return;
    }

    if (!isInIframe()) return;
    const handle = async (e: MessageEvent) => {
        if (e.source !== window.parent) return;
        const d = e.data;
        if (!isContentMessage(d)) return;
        if (d.type === 'REIS_POPUP_STATE') return;

        const r = d.type === 'REIS_SYNC_UPDATE' ? (d.data as SyncedData) : d.dataType === 'all' ? (d.data as SyncedData) : null;
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

            if (r.files) {
                for (const [c, f] of Object.entries(r.files)) {
                    const existing = await IndexedDBService.get('files', c);
                    if (!existing || (f as Record<string, unknown>).cz || !(existing as Record<string, unknown>).cz) {
                         await IndexedDBService.set('files', c, f);
                    }
                }
            }

            if (r.syllabuses) {
                for (const [c, s] of Object.entries(r.syllabuses)) {
                    const existing = await IndexedDBService.get('syllabuses', c);
                    if (!existing || (s as Record<string, unknown>).cz || !(existing as Record<string, unknown>).cz) {
                        await IndexedDBService.set('syllabuses', c, s);
                    }
                }
            }

            if (r.classmates) {
                for (const [c, cl] of Object.entries(r.classmates)) {
                    await IndexedDBService.set('classmates', c, cl as ClassmatesData);
                }
            }

            if (r.lastSync) await IndexedDBService.set('meta', 'last_sync', r.lastSync);
        } catch (idbError) {
            console.error('[useAppLogic] IDB write failed (data may be stale):', idbError);
        }

        if (typeof r.isSyncing === 'boolean') {
            if (r.isSyncing) {
                useAppStore.getState().setSyncStatus({ isSyncing: true });
            } else {
                try {
                    await useAppStore.getState().fetchAllFiles();
                    useAppStore.getState().invalidateClassmates();
                    syncGradeHistory().catch(e => console.warn('[useAppLogic] grade history sync failed:', e));
                } finally {
                    useAppStore.getState().setSyncStatus({ isSyncing: false });
                }
            }
        }
        syncService.triggerRefresh();
    };
    window.addEventListener('message', handle);
    signalReady(); requestData('all');
    return () => window.removeEventListener('message', handle);
  }, []);

  const handleOpenSubjectFromSearch = (courseCode: string, courseName?: string, courseId?: string) => {
    setSelectedSubject({ courseCode, courseName: courseName || courseCode, courseId: courseId || '', id: `search-${courseCode}`, isFromSearch: true });
  };

  return { currentDate, setCurrentDate, currentView, setCurrentView, selectedSubject, setSelectedSubject, weekNavCount, setWeekNavCount, tutorials, selectedTutorial, setSelectedTutorial, isFeedbackOpen, setIsFeedbackOpen, openSettingsRef, outlookSyncEnabled, handleOpenSubjectFromSearch };
}
