import { Sidebar } from './components/Sidebar'
import { Toaster } from './components/ui/sonner'
import { getSmartWeekRange } from '@/utils/calendar'
import { useAppLogic } from './hooks/useAppLogic'
import { AppMain } from './components/AppMain'
import { AppOverlays } from './components/AppOverlays'

function App() {
  const s = useAppLogic();

  const handlePrevWeek = () => { s.setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; }); s.setWeekNavCount(p => p + 1); };
  const handleNextWeek = () => { s.setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; }); s.setWeekNavCount(p => p + 1); };
  const handleToday = () => s.setCurrentDate(getSmartWeekRange().start);

  const getDateRangeLabel = () => {
    const end = new Date(s.currentDate); end.setDate(s.currentDate.getDate() + 6);
    return s.currentDate.getMonth() === end.getMonth() 
      ? `${s.currentDate.getDate()}. - ${end.getDate()}.${s.currentDate.getMonth() + 1}.`
      : `${s.currentDate.getDate()}.${s.currentDate.getMonth() + 1}. - ${end.getDate()}.${end.getMonth() + 1}.`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-base-200 font-sans text-base-content">
      <Toaster position="top-center" />
      <Sidebar currentView={s.currentView} onViewChange={s.setCurrentView}
               onOpenFeedback={() => s.setIsFeedbackOpen(true)} tutorials={s.tutorials} onSelectTutorial={s.setSelectedTutorial}
               onOpenSubject={s.handleOpenSubjectFromSearch} />
      
      <AppMain currentView={s.currentView} currentDate={s.currentDate} dateRangeLabel={getDateRangeLabel()}
               handlePrevWeek={handlePrevWeek} handleNextWeek={handleNextWeek} handleToday={handleToday}
               handleOpenSubjectFromSearch={s.handleOpenSubjectFromSearch} />

      <AppOverlays selectedSubject={s.selectedSubject} setSelectedSubject={s.setSelectedSubject}
                   isFeedbackOpen={s.isFeedbackOpen}
                   setIsFeedbackOpen={s.setIsFeedbackOpen} selectedTutorial={s.selectedTutorial}
                   setSelectedTutorial={s.setSelectedTutorial} />
    </div>
  )
}

export default App