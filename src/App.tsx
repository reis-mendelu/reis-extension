import { useState, useEffect, useRef } from 'react'
import './App.css'
import { Sidebar } from './components/Sidebar'
import { WeeklyCalendar } from './components/WeeklyCalendar'
import { OutlookSyncHint } from './components/OutlookSyncHint'
import { WelcomeModal } from './components/Onboarding/WelcomeModal'
import { AppHeader } from './components/AppHeader'
import { Toaster } from './components/ui/sonner'


import { getSmartWeekRange } from './utils/calendarUtils'
import { ExamPanel } from './components/ExamPanel'
import { SubjectFileDrawer } from './components/SubjectFileDrawer'
import { type AppView } from './components/Sidebar'
import { signalReady, requestData, isInIframe } from './api/proxyClient'
import type { SyncedData } from './types/messages'
import { StorageService, STORAGE_KEYS } from './services/storage'
import { syncService, outlookSyncService } from './services/sync'
import { useOutlookSync } from './hooks/data'

import { FeedbackModal } from './components/Feedback/FeedbackModal'
import { TutorialList, TutorialModal } from './components/Tutorials'
import { fetchTutorials } from './services/tutorials'
import type { Tutorial } from './services/tutorials'
import { useSpolkySettings } from './hooks/useSpolkySettings'

function App() {
  // Initialize Outlook sync service on startup
  useEffect(() => {
    outlookSyncService.init();
  }, []);
  
  const [currentDate, setCurrentDate] = useState(() => {
    // Try to restore previously selected week from localStorage
    const DATE_STORAGE_KEY = 'reis_current_week';
    const stored = localStorage.getItem(DATE_STORAGE_KEY);
    if (stored) {
      const parsed = new Date(stored);
      if (!isNaN(parsed.getTime())) {
        console.debug('[App] Restoring week from storage:', stored);
        return parsed;
      }
    }
    // Fallback to smart week (current/next week based on day)
    const { start } = getSmartWeekRange();
    return start;
  });

  // Persist selected week to localStorage
  useEffect(() => {
    const DATE_STORAGE_KEY = 'reis_current_week';
    localStorage.setItem(DATE_STORAGE_KEY, currentDate.toISOString());
  }, [currentDate]);

  // View state for main content area (persisted to localStorage)
  const VIEW_STORAGE_KEY = 'reis_current_view';
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    console.debug('[App] Initializing view from storage:', stored);
    return (stored === 'exams' ? 'exams' : 'calendar') as AppView;
  });
  
  // Drawer state
  const [selectedSubject, setSelectedSubject] = useState<any>(null);

  const handleSelectSubject = (subj: any) => {
    console.log('[App] Selected subject:', subj);
    setSelectedSubject(subj);
  };

  const handleOpenSubjectFromSearch = (courseCode: string, courseName?: string, courseId?: string) => {
    console.log('[App] Opening subject from search:', courseCode, 'courseId:', courseId);
    // Create a minimal lesson-like object for the drawer
    const lessonObj = {
      courseCode,
      courseName: courseName || courseCode,
      courseId: courseId || '', // Use provided ID from search result
      id: `search-${courseCode}`,
      date: '',
      startTime: '',
      endTime: '',
      room: '',
      teachers: [],
      isExam: false,
      isFromSearch: true, // Flag to indicate opened from search (for default tab)
    };
    setSelectedSubject(lessonObj);
  };
  
  // Persist view changes
  useEffect(() => {
    console.debug('[App] Persisting view to storage:', currentView);
    localStorage.setItem(VIEW_STORAGE_KEY, currentView);
  }, [currentView]);
  
  // Navigation count for Outlook sync hint trigger
  const [weekNavCount, setWeekNavCount] = useState(0);
  
  // Outlook sync state
  const { isEnabled: outlookSyncEnabled } = useOutlookSync();
  
  // Ref to trigger opening settings popup in Sidebar
  const openSettingsRef = useRef<(() => void) | null>(null);

  const [syncData, setSyncData] = useState<SyncedData | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Tutorial state
  const [isTutorialListOpen, setIsTutorialListOpen] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [isTutorialsLoading, setIsTutorialsLoading] = useState(false);
  const { subscribedAssociations } = useSpolkySettings();

  // Fetch tutorials when list is opened
  const handleOpenTutorials = async () => {
    setIsTutorialListOpen(true);
    setIsTutorialsLoading(true);
    try {
      console.log('[App] Fetching tutorials for associations:', subscribedAssociations);
      const data = await fetchTutorials(subscribedAssociations);
      console.log('[App] Received tutorials:', data);
      setTutorials(data);
    } catch (error) {
      console.error('[App] Failed to fetch tutorials:', error);
    } finally {
      setIsTutorialsLoading(false);
    }
  };

  const handleSelectTutorial = (tutorial: Tutorial) => {
    setIsTutorialListOpen(false);
    setSelectedTutorial(tutorial);
  };

  const handleCloseTutorialModal = () => {
    setSelectedTutorial(null);
  };

  // Set up postMessage communication with Content Script
  useEffect(() => {
    // Only set up iframe communication if we're in an iframe
    if (isInIframe()) {
      console.log('[App] Running in iframe, setting up postMessage listener');

      const handleMessage = (event: MessageEvent) => {
        // Accept messages from parent (content script)
        if (event.source !== window.parent) return;

        const data = event.data;
        if (!data || typeof data !== 'object') return;

        console.log('[App] Received message:', data.type);

        if (data.type === 'REIS_DATA' || data.type === 'REIS_SYNC_UPDATE') {
          const receivedData = data.data || data;
          setSyncData(receivedData);

          // Write data to localStorage so child components can read it
          // This bridges the gap between postMessage and StorageService
          if (receivedData.schedule) {
            StorageService.set(STORAGE_KEYS.SCHEDULE_DATA, receivedData.schedule);
            console.log('[App] Wrote schedule to localStorage:', Array.isArray(receivedData.schedule) ? receivedData.schedule.length : 'non-array');
          }
          if (receivedData.exams) {
            StorageService.set(STORAGE_KEYS.EXAMS_DATA, receivedData.exams);
            console.log('[App] Wrote exams to localStorage:', Array.isArray(receivedData.exams) ? receivedData.exams.length : 'non-array');
          }
          if (receivedData.subjects) {
            StorageService.set(STORAGE_KEYS.SUBJECTS_DATA, receivedData.subjects);
            console.log('[App] Wrote subjects to localStorage');
          }
          if (receivedData.files && typeof receivedData.files === 'object') {
            // Write files for each subject with prefix key
            const filesData = receivedData.files as Record<string, unknown>;
            const subjectCount = Object.keys(filesData).length;
            for (const [courseCode, files] of Object.entries(filesData)) {
              const key = `${STORAGE_KEYS.SUBJECT_FILES_PREFIX}${courseCode}`;
              StorageService.set(key, files);
            }
            console.log('[App] Wrote files for', subjectCount, 'subjects to localStorage');
          }
          if (receivedData.assessments && typeof receivedData.assessments === 'object') {
            // Write assessments for each subject with prefix key
            const assessmentsMap = receivedData.assessments as Record<string, unknown>;
            for (const [courseCode, assessments] of Object.entries(assessmentsMap)) {
              const key = `${STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX}${courseCode}`;
              StorageService.set(key, assessments);
            }
            console.log('[App] Wrote assessments for', Object.keys(assessmentsMap).length, 'subjects to localStorage');
          }
          if (receivedData.lastSync) {
            StorageService.set(STORAGE_KEYS.LAST_SYNC, receivedData.lastSync);
          }

          // Trigger hooks to re-read from localStorage
          syncService.triggerRefresh();

          console.log('[App] Data received, written to localStorage, loading complete');
        }
      };

      window.addEventListener('message', handleMessage);

      // Signal that iframe is ready
      signalReady();

      // Request initial data
      requestData('all');

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    } else {
      // Not in iframe (dev mode)
      console.log('[App] Running standalone (dev mode)');
    }
  }, []);

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
    setWeekNavCount(prev => prev + 1);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
    setWeekNavCount(prev => prev + 1);
  };

  const handleToday = () => {
    const { start } = getSmartWeekRange();
    setCurrentDate(start);
  };

  const getDateRangeLabel = () => {
    // Show date range like "3.12. - 9.12." or "28.12. - 3.1." if spanning months
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 6);

    const startDay = currentDate.getDate();
    const startMonth = currentDate.getMonth() + 1;
    const endDay = weekEnd.getDate();
    const endMonth = weekEnd.getMonth() + 1;

    if (startMonth === endMonth) {
      return `${startDay}. - ${endDay}.${startMonth}.`;
    } else {
      return `${startDay}.${startMonth}. - ${endDay}.${endMonth}.`;
    }
  };



  // Log sync data for debugging
  if (syncData) {
    console.log('[App] Current sync data:', {
      hasSchedule: !!syncData.schedule,
      hasExams: !!syncData.exams,
      hasSubjects: !!syncData.subjects,
      hasAssessments: !!syncData.assessments || Object.keys(localStorage).some(k => k.startsWith(STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX)),
      lastSync: syncData.lastSync
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base-200 font-sans text-base-content">
      <Toaster position="top-center" />
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenSettingsRef={openSettingsRef}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenTutorials={handleOpenTutorials}
      />
      <main className="flex-1 flex flex-col ml-0 md:ml-20 transition-all duration-300 overflow-hidden">
        <AppHeader 
          currentView={currentView}
          dateRangeLabel={getDateRangeLabel()}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onToday={handleToday}
          onOpenSubject={handleOpenSubjectFromSearch}
        />

        <div className="flex-1 pt-3 px-4 pb-1 overflow-hidden flex flex-col">
          <div className="flex-1 bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
            {currentView === 'calendar' ? (
              <WeeklyCalendar
                key={currentDate.toISOString()}
                initialDate={currentDate}
              />
            ) : (
              <ExamPanel 
                onSelectSubject={handleSelectSubject}
              />
            )}
          </div>
        </div>
      </main>

      {/* ExamDrawer removed - replaced by ExamPanel view */}
      <SubjectFileDrawer
        lesson={selectedSubject}
        isOpen={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
      />
      
      
      {/* Outlook Sync Tutorial Hint */}
      <OutlookSyncHint
        navigationCount={weekNavCount}
        isSyncEnabled={outlookSyncEnabled}
        onSetup={() => openSettingsRef.current?.()}
      />

      {/* First-run Welcome Modal */}
      <WelcomeModal />

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* Tutorial List Modal */}
      <TutorialList
        tutorials={tutorials}
        isOpen={isTutorialListOpen}
        isLoading={isTutorialsLoading}
        onClose={() => setIsTutorialListOpen(false)}
        onSelectTutorial={handleSelectTutorial}
      />

      {/* Tutorial Viewer Modal */}
      {selectedTutorial && (
        <TutorialModal
          tutorial={selectedTutorial}
          isOpen={!!selectedTutorial}
          onClose={handleCloseTutorialModal}
        />
      )}
    </div>
  )
}

export default App