import { useState, useEffect, useRef } from 'react';
import { getSmartWeekRange } from '../utils/calendar';
import { IndexedDBService } from '../services/storage';
import { syncService, outlookSyncService } from '../services/sync';
import { useOutlookSync } from '../hooks/data';
import { fetchTutorials } from '../services/tutorials';
import type { Tutorial } from '../services/tutorials';
import { useSpolkySettings } from './useSpolkySettings';
import { useAppStore, initializeStore } from '../store/useAppStore';
import { signalReady, requestData, isInIframe } from '../api/proxyClient';
import type { AppView, SelectedSubject } from '../types/app';
import { isContentMessage } from '../types/messages';

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
        
        const r = d.type === 'REIS_SYNC_UPDATE' ? d.data : d.dataType === 'all' ? (d.data as any) : null;
        if (!r) return;

        if (r.schedule) await IndexedDBService.set('schedule', 'current', r.schedule);
        if (r.exams) await IndexedDBService.set('exams', 'current', r.exams);
        if (r.subjects) {
            const existing = await IndexedDBService.get('subjects', 'current');
            if (existing && existing.data) {
                // Merge dual-language names into incoming data if incoming is missing them
                Object.keys(r.subjects.data).forEach(code => {
                    const incomingSub = r.subjects.data[code];
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
                // Only overwrite if incoming has more content or existing is not dual-language
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

        if (r.lastSync) IndexedDBService.set('meta', 'last_sync', r.lastSync);
        if (typeof r.isSyncing === 'boolean') useAppStore.getState().setSyncStatus({ isSyncing: r.isSyncing });
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
