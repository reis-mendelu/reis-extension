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
import StudyProgramPanel from './components/StudyProgramPanel'
import { SubjectFileDrawer } from './components/SubjectFileDrawer'
import { type AppView } from './components/Sidebar'
import { signalReady, requestData, isInIframe } from './api/proxyClient'
import { IndexedDBService } from './services/storage'
import { syncService, outlookSyncService } from './services/sync'
import { useOutlookSync } from './hooks/data'

import { FeedbackModal } from './components/Feedback/FeedbackModal'
import { TutorialModal } from './components/Tutorials'
import { fetchTutorials } from './services/tutorials'
import type { Tutorial } from './services/tutorials'
import { useSpolkySettings } from './hooks/useSpolkySettings'
import { initializeStore } from './store/useAppStore';
import { useSchedule } from './hooks/data';

function App() {
  // Initialize Outlook sync service on startup
  useEffect(() => {
    outlookSyncService.init();
  }, []);

  useEffect(() => {
      const unsubscribe = initializeStore();
      return () => unsubscribe();
  }, []);

  useSchedule();
  
  const [currentDate, setCurrentDate] = useState<Date>(() => {
      const { start } = getSmartWeekRange();
      return start;
  });
  
  // Load week from basic storage
  useEffect(() => {
     IndexedDBService.get('meta', 'reis_current_week').then(stored => {
         if (stored && typeof stored === 'string') {
             const parsed = new Date(stored);
             if (!isNaN(parsed.getTime())) {
                 setCurrentDate(parsed);
             }
         }
     });
  }, []);

  // Persist selected week
  useEffect(() => {
    IndexedDBService.set('meta', 'reis_current_week', currentDate.toISOString());
  }, [currentDate]);

  // View state for main content area
  const VIEW_STORAGE_KEY = 'reis_current_view';
  const [currentView, setCurrentView] = useState<AppView>('calendar'); 

  // Load view
  useEffect(() => {
      IndexedDBService.get('meta', VIEW_STORAGE_KEY).then(stored => {
          if (stored) {
              setCurrentView(stored as AppView);
          }
      });
  }, []);

  // View state change handling
  useEffect(() => {
    // Hidden logging or track analytics here if needed
  }, [currentView]);
  
  // Drawer state
  const [selectedSubject, setSelectedSubject] = useState<any>(null);

  const handleSelectSubject = (subj: any) => {
    setSelectedSubject(subj);
  };

  const handleOpenSubjectFromSearch = (courseCode: string, courseName?: string, courseId?: string) => {
    // Create a minimal lesson-like object for the drawer
    const lessonObj = {
      courseCode,
      courseName: courseName || courseCode,
      courseId: courseId || '', // Use provided ID from search result or sidebar
      id: `search-${courseCode}`,
      date: '',
      startTime: '',
      endTime: '',
      room: '',
      teachers: [],
      isExam: false,
      isFromSearch: true, // Flag to indicate opened from search/sidebar (for default tab)
    };
    setSelectedSubject(lessonObj);
  };
  
  // Persist view changes
  useEffect(() => {
    IndexedDBService.set('meta', VIEW_STORAGE_KEY, currentView);
  }, [currentView]);
  
  // Navigation count for Outlook sync hint trigger
  const [weekNavCount, setWeekNavCount] = useState(0);
  
  // Outlook sync state
  const { isEnabled: outlookSyncEnabled } = useOutlookSync();
  
  // Ref to trigger opening settings popup in Sidebar
  const openSettingsRef = useRef<(() => void) | null>(null);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Tutorial state
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  // const [isTutorialsLoading, setIsTutorialsLoading] = useState(false); // Unused if fetching on load
  const { subscribedAssociations } = useSpolkySettings();

  // Fetch tutorials on app load
  useEffect(() => {
    const loadTutorials = async () => {
      // setIsTutorialsLoading(true);
      try {
        const data = await fetchTutorials(subscribedAssociations);
        setTutorials(data);
      } catch (error) {
        console.error('[App] Failed to fetch tutorials:', error);
      } finally {
        // setIsTutorialsLoading(false);
      }
    };
    
    // Initial fetch
    loadTutorials();
  }, [subscribedAssociations]);

  const handleSelectTutorial = (tutorial: Tutorial) => {
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

        if (data.type === 'REIS_DATA' || data.type === 'REIS_SYNC_UPDATE') {
          const receivedData = data.data || data;
          if (receivedData.schedule) {
            IndexedDBService.set('schedule', 'current', receivedData.schedule)
              .catch(err => console.error('[App] Failed to write schedule to IDB:', err));
          }
          if (receivedData.exams) {
            IndexedDBService.set('exams', 'current', receivedData.exams)
              .catch(err => console.error('[App] Failed to write exams to IDB:', err));
          }
          if (receivedData.subjects) {
            IndexedDBService.set('subjects', 'current', receivedData.subjects)
              .catch(err => console.error('[App] Failed to write subjects to IDB:', err));
          }
          if (receivedData.files && typeof receivedData.files === 'object') {
            const filesData = receivedData.files as Record<string, any>;
            for (const [courseCode, files] of Object.entries(filesData)) {
              IndexedDBService.set('files', courseCode, files)
                .catch(err => console.error(`[App] Failed to write files for ${courseCode} to IDB:`, err));
            }
          }
          if (receivedData.assessments && typeof receivedData.assessments === 'object') {
            const assessmentsMap = receivedData.assessments as Record<string, any>;
            for (const [courseCode, assessments] of Object.entries(assessmentsMap)) {
               IndexedDBService.set('assessments', courseCode, assessments)
                 .catch(err => console.error(`[App] Failed to write assessments for ${courseCode} to IDB:`, err));
            }
          }
          if (receivedData.syllabuses && typeof receivedData.syllabuses === 'object') {
            const syllabusesMap = receivedData.syllabuses as Record<string, any>;
            for (const [courseCode, syllabus] of Object.entries(syllabusesMap)) {
              IndexedDBService.set('syllabuses', courseCode, syllabus)
                .catch(err => console.error(`[App] Failed to write syllabus for ${courseCode} to IDB:`, err));
            }
          }
           if (receivedData.studyProgram) {
             IndexedDBService.set('study_program', 'current', receivedData.studyProgram as any)
                 .then(() => {
                     // Trigger update for hooks that rely on this
                     syncService.triggerRefresh('STUDY_PROGRAM_UPDATE'); 
                 })
                 .catch(err => console.error('[App] Failed to write Study Program to IDB:', err));
          }
          if (receivedData.lastSync) {
            IndexedDBService.set('meta', 'last_sync', receivedData.lastSync);
          }

          // Trigger hooks to re-read from localStorage
          syncService.triggerRefresh();

          console.log('[App] Data processing complete');
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



  // Render main layout
  return (
    <div className="flex h-screen overflow-hidden bg-base-200 font-sans text-base-content">
      <Toaster position="top-center" />
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenSettingsRef={openSettingsRef}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        tutorials={tutorials}
        onSelectTutorial={handleSelectTutorial}
        onOpenSubject={handleOpenSubjectFromSearch}
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
            {currentView === 'calendar' && (
              <WeeklyCalendar
                key={currentDate.toISOString()}
                initialDate={currentDate}
              />
            )}
            {currentView === 'exams' && (
              <ExamPanel 
                onSelectSubject={handleSelectSubject}
              />
            )}
            {currentView === 'study-program' && (
              <StudyProgramPanel 
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