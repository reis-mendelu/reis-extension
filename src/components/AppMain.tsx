import type { AppView } from '../types/app'
import { AppHeader } from './AppHeader'
import { WeeklyCalendar } from './WeeklyCalendar/index'
import { ExamPanel } from './ExamPanel'
import { SubjectsPanel } from './SubjectsPanel'
import { StudyPlanPage } from './SubjectsPanel/StudyPlanPage'
import { ErasmusPanel } from './ErasmusPanel'
import { NpsBanner } from './Feedback/NpsBanner'
import { useAppStore } from '../store/useAppStore'

interface AppMainProps {
    currentView: AppView;
    currentDate: Date;
    handlePrevWeek: () => void;
    handleNextWeek: () => void;
    handleToday: () => void;
    handleOpenSubjectFromSearch: (courseCode: string, courseName?: string, courseId?: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
    dateRangeLabel: string;
    searchPrefillRef?: React.MutableRefObject<((query: string) => void) | null>;
    setCurrentView?: (view: AppView) => void;
    openFeedback?: () => void;
}

export function AppMain({
    currentView, currentDate, handlePrevWeek, handleNextWeek, handleToday,
    handleOpenSubjectFromSearch, dateRangeLabel, searchPrefillRef, setCurrentView, openFeedback
}: AppMainProps) {
    // When the soft keyboard opens on touch, the bottom-nav slides off via
    // translate-y-full; collapse its reserved padding so the content fills the
    // space instead of leaving a 64px dead band above the keyboard.
    // (Tailwind's `data-[...]:` variant targets the element itself, not <html>,
    // so the previous data-attribute approach silently did nothing.)
    const keyboardOpen = useAppStore((s) => s.keyboardOpen);
    const bottomPaddingClass = keyboardOpen ? 'touch:pb-1' : 'touch:pb-16';

    return (
        <main className="flex-1 flex flex-col transition-all duration-300 overflow-hidden">
            <AppHeader currentView={currentView} currentDate={currentDate} dateRangeLabel={dateRangeLabel} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} onToday={handleToday} onOpenSubject={handleOpenSubjectFromSearch} searchPrefillRef={searchPrefillRef} setCurrentView={setCurrentView} openFeedback={openFeedback} />
            <NpsBanner />
            <div className={`flex-1 pt-3 px-4 pb-1 ${bottomPaddingClass} overflow-hidden flex flex-col`}>
                <div className="flex-1 bg-base-100 rounded-lg touch:rounded-t-lg touch:rounded-b-none shadow-sm border border-base-300 overflow-hidden">
                    {currentView === 'calendar' && <WeeklyCalendar key={currentDate.toISOString()} initialDate={currentDate} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} onOpenExams={setCurrentView ? () => setCurrentView('exams') : undefined} />}
                    {currentView === 'exams' && <ExamPanel />}
                    {currentView === 'subjects' && <SubjectsPanel onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} onOpenStudyPlan={() => setCurrentView?.('studyPlan')} />}
                    {currentView === 'studyPlan' && <StudyPlanPage onBack={() => setCurrentView?.('subjects')} onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} />}
                    {currentView === 'erasmus' && <ErasmusPanel onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} />}
                </div>
            </div>
        </main>
    );
}
