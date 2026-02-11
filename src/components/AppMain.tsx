import type { AppView } from '../types/app'
import { AppHeader } from './AppHeader'
import { WeeklyCalendar } from './WeeklyCalendar/index'
import type { ExamSubject } from '../types/exams';
import { ExamPanel } from './ExamPanel'

interface AppMainProps {
    currentView: AppView;
    currentDate: Date;
    handlePrevWeek: () => void;
    handleNextWeek: () => void;
    handleToday: () => void;
    handleOpenSubjectFromSearch: (courseCode: string, courseName?: string, courseId?: string) => void;
    setSelectedSubject: (subject: ExamSubject & { courseCode: string; courseName: string; sectionName: string; isExam: true }) => void;
    dateRangeLabel: string;
}

export function AppMain({ 
    currentView, currentDate, handlePrevWeek, handleNextWeek, handleToday, 
    handleOpenSubjectFromSearch, setSelectedSubject, dateRangeLabel
}: AppMainProps) {
    return (
        <main className="flex-1 flex flex-col ml-0 md:ml-20 transition-all duration-300 overflow-hidden">
            <AppHeader currentView={currentView} dateRangeLabel={dateRangeLabel} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} onToday={handleToday} onOpenSubject={handleOpenSubjectFromSearch} />
            <div className="flex-1 pt-3 px-4 pb-1 overflow-hidden flex flex-col">
                <div className="flex-1 bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
                    {currentView === 'calendar' && <WeeklyCalendar key={currentDate.toISOString()} initialDate={currentDate} />}
                    {currentView === 'exams' && <ExamPanel onSelectSubject={setSelectedSubject} />}
                </div>
            </div>
        </main>
    );
}
