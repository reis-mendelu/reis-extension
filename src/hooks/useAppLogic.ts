import { useState, useEffect, useRef } from 'react';
import { getSmartWeekRange } from '../utils/calendarUtils';
import { IndexedDBService } from '../services/storage';
import { syncService, outlookSyncService } from '../services/sync';
import { useOutlookSync } from '../hooks/data';
import { fetchTutorials } from '../services/tutorials';
import type { Tutorial } from '../services/tutorials';
import { useSpolkySettings } from './useSpolkySettings';
import { useAppStore, initializeStore } from '../store/useAppStore';
import { signalReady, requestData, isInIframe } from '../api/proxyClient';
import type { AppView } from '../types/app';

export function useAppLogic() {
  const [currentDate, setCurrentDate] = useState<Date>(() => getSmartWeekRange().start);
  const [currentView, setCurrentView] = useState<AppView>('calendar');
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [weekNavCount, setWeekNavCount] = useState(0);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const openSettingsRef = useRef<(() => void) | null>(null);
  const { isEnabled: outlookSyncEnabled } = useOutlookSync();
  const { subscribedAssociations } = useSpolkySettings();

  useEffect(() => {
    outlookSyncService.init();
    const unsub = initializeStore();
    return () => { unsub(); };
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
    if (!isInIframe()) return;
    const handle = (e: MessageEvent) => {
        if (e.source !== window.parent) return;
        const d = e.data;
        if (!d || (d.type !== 'REIS_DATA' && d.type !== 'REIS_SYNC_UPDATE')) return;
        const r = d.data || d;
        if (r.schedule) IndexedDBService.set('schedule', 'current', r.schedule);
        if (r.exams) IndexedDBService.set('exams', 'current', r.exams);
        if (r.subjects) IndexedDBService.set('subjects', 'current', r.subjects);
        if (r.files) Object.entries(r.files).forEach(([c, f]) => IndexedDBService.set('files', c, f as any));
        if (r.assessments) Object.entries(r.assessments).forEach(([c, a]) => IndexedDBService.set('assessments', c, a as any));
        if (r.syllabuses) Object.entries(r.syllabuses).forEach(([c, s]) => IndexedDBService.set('syllabuses', c, s as any));
        if (r.studyProgram) IndexedDBService.set('study_program', 'current', r.studyProgram).then(() => syncService.triggerRefresh('STUDY_PROGRAM_UPDATE'));
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
