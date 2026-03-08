import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { SearchBar } from './SearchBar/index';
import { MobileSearchOverlay } from './SearchBar/MobileSearchOverlay';
import { useTranslation } from '../hooks/useTranslation';
import { NotificationFeed } from './NotificationFeed';
import { useAppStore } from '../store/useAppStore';
import { getCommandActions } from './SearchBar/actions';

interface AppHeaderProps {
  currentView: string;
  dateRangeLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
  searchPrefillRef?: React.MutableRefObject<((query: string) => void) | null>;
  setCurrentView?: (view: 'calendar' | 'exams' | 'subjects') => void;
  openFeedback?: () => void;
}

export function AppHeader({
  currentView,
  dateRangeLabel,
  onPrevWeek,
  onNextWeek,
  onToday,
  onOpenSubject,
  searchPrefillRef,
  setCurrentView,
  openFeedback,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const language = useAppStore(s => s.language);
  const setLanguage = useAppStore(s => s.setLanguage);

  const actions = useMemo(() => getCommandActions({
    setCurrentView: setCurrentView || (() => {}),
    setTheme,
    setLanguage,
    openFeedback: openFeedback || (() => {}),
    theme,
    language,
    t,
  }), [setCurrentView, setTheme, setLanguage, openFeedback, theme, language, t]);

  return (
    <>
      <div className="flex-shrink-0 z-30 bg-base-200/90 backdrop-blur-md border-b border-base-300 px-4 pt-5 pb-3">
        <div className="relative flex items-center justify-between gap-2 md:gap-4 w-full">
          {currentView === 'calendar' && (
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 z-10">
              <div className="flex items-center bg-base-300 rounded-lg p-1">
                <button
                  onClick={onPrevWeek}
                  className="p-1 hover:bg-base-100 rounded-md shadow-sm transition-all text-base-content/70 hover:text-primary"
                  aria-label="Previous week"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={onNextWeek}
                  className="p-1 hover:bg-base-100 rounded-md shadow-sm transition-all text-base-content/70 hover:text-primary"
                  aria-label="Next week"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <button onClick={onToday} className="btn btn-primary btn-sm border-none shadow-sm">
                {t('common.today')}
              </button>
              <span className="hidden lg:inline text-lg font-semibold text-base-content whitespace-nowrap">{dateRangeLabel}</span>
            </div>
          )}

          {/* Desktop: hero search bar — absolutely centered in header */}
          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
            <div className="w-full max-w-2xl pointer-events-auto">
              <SearchBar onOpenSubject={onOpenSubject} prefillRef={searchPrefillRef} actions={actions} />
            </div>
          </div>

          {/* Mobile: search icon button */}
          <button
            onClick={() => setMobileSearchOpen(true)}
            className="md:hidden p-2 hover:bg-base-300 rounded-lg flex-shrink-0"
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          <div className="flex-shrink-0 ml-auto z-10">
            <NotificationFeed />
          </div>
        </div>
      </div>

      <MobileSearchOverlay
        isOpen={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        onOpenSubject={onOpenSubject}
        actions={actions}
      />
    </>
  );
}
