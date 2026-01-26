import { AppHeader } from './AppHeader'
import { WeeklyCalendar } from './WeeklyCalendar'
import { ExamPanel } from './ExamPanel'
import StudyProgramPanel from './StudyProgramPanel'

export function AppMain({ 
    currentView, currentDate, handlePrevWeek, handleNextWeek, handleToday, 
    handleOpenSubjectFromSearch, setSelectedSubject, dateRangeLabel 
}: any) {
    return (
        <main className="flex-1 flex flex-col ml-0 md:ml-20 transition-all duration-300 overflow-hidden">
            <AppHeader currentView={currentView} dateRangeLabel={dateRangeLabel} onPrevWeek={handlePrevWeek} onNextWeek={handleNextWeek} onToday={handleToday} onOpenSubject={handleOpenSubjectFromSearch} />
            <div className="flex-1 pt-3 px-4 pb-1 overflow-hidden flex flex-col">
                <div className="flex-1 bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
                    {currentView === 'calendar' && <WeeklyCalendar key={currentDate.toISOString()} initialDate={currentDate} />}
                    {currentView === 'exams' && <ExamPanel onSelectSubject={setSelectedSubject} />}
                    {currentView === 'study-program' && <StudyProgramPanel onSelectSubject={setSelectedSubject} />}
                </div>
            </div>
        </main>
    );
}
