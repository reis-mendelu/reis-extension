import { useIsMobile } from '../hooks/ui/useIsMobile'
import type { AppView } from '../types/app'
import { AppHeader } from './AppHeader'
import { WeeklyCalendar } from './WeeklyCalendar/index'
import { ExamPanel } from './ExamPanel'
import { SubjectsPanel } from './SubjectsPanel'
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
}

export function AppMain({
    currentView, currentDate, handlePrevWeek, handleNextWeek, handleToday,
    handleOpenSubjectFromSearch, dateRangeLabel, searchPrefillRef
}: AppMainProps) {
    const isMobile = useIsMobile();
    // Only handle swipe at this level for desktop week view;
    // on mobile, DailyView owns its own day-by-day swipe.
    const { onTouchStart, onTouchMove, onTouchEnd, dragStyle } = useSwipeNavigation(handlePrevWeek, handleNextWeek);

    return (
        <main className="flex-1 flex flex-col transition-all duration-300 overflow-hidden">
            <AppHeader currentView={currentView} dateRangeLabel={dateRangeLabel} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} onToday={handleToday} onOpenSubject={handleOpenSubjectFromSearch} searchPrefillRef={searchPrefillRef} />
            <NpsBanner />
            <div
                className="flex-1 pt-3 px-4 pb-16 md:pb-1 overflow-hidden flex flex-col"
                onTouchStart={!isMobile ? onTouchStart : undefined}
                onTouchMove={!isMobile ? onTouchMove : undefined}
                onTouchEnd={!isMobile ? onTouchEnd : undefined}
            >
                <div
                    className="flex-1 bg-base-100 rounded-t-lg rounded-b-none md:rounded-lg shadow-sm border border-base-300 overflow-hidden"
                    style={!isMobile ? dragStyle : undefined}
                >
                    {currentView === 'calendar' && <WeeklyCalendar key={currentDate.toISOString()} initialDate={currentDate} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} />}
                    {currentView === 'exams' && <ExamPanel />}
                    {currentView === 'subjects' && <SubjectsPanel onOpenSubject={handleOpenSubjectFromSearch} onSearchSubject={(name) => searchPrefillRef?.current?.(name)} />}
                </div>
            </div>
        </main>
    );
}
