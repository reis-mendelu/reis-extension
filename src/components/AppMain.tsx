import { useIsMobile } from '../hooks/ui/useIsMobile'
import type { AppView } from '../types/app'
import { AppHeader } from './AppHeader'
import { WeeklyCalendar } from './WeeklyCalendar/index'
import { ExamPanel } from './ExamPanel'
import { SubjectsPanel } from './SubjectsPanel'
import { ErasmusPanel } from './ErasmusPanel'
import { useSwipeNavigation } from '../hooks/ui/useSwipeNavigation'
import { NpsBanner } from './Feedback/NpsBanner'

interface AppMainProps {
    currentView: AppView;
    currentDate: Date;
    handlePrevWeek: () => void;
    handleNextWeek: () => void;
    handleToday: () => void;
    handleOpenSubjectFromSearch: (courseCode: string, courseName?: string, courseId?: string) => void;
    dateRangeLabel: string;
    searchPrefillRef?: React.MutableRefObject<((query: string) => void) | null>;
    setCurrentView?: (view: AppView) => void;
    openFeedback?: () => void;
}

export function AppMain({
    currentView, currentDate, handlePrevWeek, handleNextWeek, handleToday,
    handleOpenSubjectFromSearch, dateRangeLabel, searchPrefillRef, setCurrentView, openFeedback
}: AppMainProps) {
    const isMobile = useIsMobile();
    // Only handle swipe at this level for desktop week view;
    // on mobile, DailyView owns its own day-by-day swipe.
    const { onTouchStart, onTouchMove, onTouchEnd, dragStyle } = useSwipeNavigation(handlePrevWeek, handleNextWeek);

    return (
        <main className="flex-1 flex flex-col transition-all duration-300 overflow-hidden">
            <AppHeader currentView={currentView} currentDate={currentDate} dateRangeLabel={dateRangeLabel} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} onToday={handleToday} onOpenSubject={handleOpenSubjectFromSearch} searchPrefillRef={searchPrefillRef} setCurrentView={setCurrentView} openFeedback={openFeedback} />
            <NpsBanner />
            <div
                className="flex-1 pt-3 px-4 pb-1 touch:pb-16 overflow-hidden flex flex-col"
                onTouchStart={!isMobile ? onTouchStart : undefined}
                onTouchMove={!isMobile ? onTouchMove : undefined}
                onTouchEnd={!isMobile ? onTouchEnd : undefined}
            >
                <div
                    className="flex-1 bg-base-100 rounded-lg touch:rounded-t-lg touch:rounded-b-none shadow-sm border border-base-300 overflow-hidden"
                    style={!isMobile ? dragStyle : undefined}
                >
                    {currentView === 'calendar' && <WeeklyCalendar key={currentDate.toISOString()} initialDate={currentDate} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} />}
                    {currentView === 'exams' && <ExamPanel />}
                    {currentView === 'subjects' && <SubjectsPanel onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} />}
                    {currentView === 'erasmus' && <ErasmusPanel onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} />}
                </div>
            </div>
        </main>
    );
}
