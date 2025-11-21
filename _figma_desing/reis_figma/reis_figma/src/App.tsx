import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import mendeluLogo from 'figma:asset/5476481a00cb4d91249cc77b7e8c68fee66f34f1.png';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Calendar navigation functions
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newDate);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  // Get week dates for month/year display
  const getWeekDates = () => {
    const week = [];
    const start = new Date(currentWeek);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates();

  // Keyboard support - ESC to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen bg-white">
      {/* Unified Header - Full width at top */}
      <div className="w-full bg-white h-14 flex items-center fixed top-0 left-0 right-0 z-[140]">
        {/* Spacer for logo area */}
        <div className="w-16 h-14 flex-shrink-0"></div>
        
        {/* Calendar navigation controls */}
        <div className="flex items-center gap-3 px-4">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
          >
            Dnes
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <h2 className="text-sm text-gray-700">
            {weekDates[0].toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        {/* SearchBar Section - Smaller and right-aligned */}
        <div className="flex-1 flex justify-end pr-2">
          <div className="w-1/2">
            <SearchBar placeholder="Prohledej reIS" onSearch={(query) => console.log(query)} />
          </div>
        </div>
      </div>
      
      {/* Logo positioned absolutely at crossroad */}
      <div className="fixed top-2 left-3 z-[150]">
        <img src={mendeluLogo} alt="Mendelu" className="h-10 w-10 rounded-lg" />
      </div>
      
      {/* Content area below fixed header */}
      <div className="flex pt-14">
        {/* Sidebar - L-shaped unified block */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        
        {/* Calendar area with gray background */}
        <div className="flex-1 bg-white p-6 ml-16 min-h-screen">
          <WeeklyCalendar 
            currentWeek={currentWeek}
            onNavigateWeek={navigateWeek}
            onGoToToday={goToToday}
          />
        </div>
      </div>
    </div>
  );
}