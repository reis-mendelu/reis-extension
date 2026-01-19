import { useState, useRef, useEffect } from 'react';
import {
  Settings,
} from 'lucide-react';
import { MENDELU_LOGO_PATH, OUTLOOK_ICON_PATH, TEAMS_ICON_PATH } from '../constants/icons';
import { getMainMenuItems } from './menuConfig';
import { NavItem } from './Sidebar/NavItem';
import { ProfilePopup } from './Sidebar/ProfilePopup';

export type AppView = 'calendar' | 'exams';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  /** Ref that will be populated with a function to open settings popup */
  onOpenSettingsRef?: React.MutableRefObject<(() => void) | null>;
  onOpenReservation?: () => void;
  onOpenFeedback: () => void;
  onOpenTutorials?: () => void;
}

export const Sidebar = ({ currentView, onViewChange, onOpenSettingsRef, onOpenFeedback, onOpenTutorials }: SidebarProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const profileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expose open function to parent via ref
  useEffect(() => {
    if (onOpenSettingsRef) {
      onOpenSettingsRef.current = () => setIsSettingsOpen(true);
    }
  }, [onOpenSettingsRef]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Logic modified to rely on hover mainly, but click outside can still close it forcefully if needed.
      // With hover, this might not be strictly necessary if we rely purely on mouseLeave.
      // However, keeping it as fallback.
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainMenuItems = getMainMenuItems();

  const handleMouseEnter = (itemId: string) => {
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
    }
    setHoveredItem(itemId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
        setHoveredItem(null);
    }, 300);
  };

  const handleProfileMouseEnter = () => {
    if (profileTimeoutRef.current) {
        clearTimeout(profileTimeoutRef.current);
    }
    setIsSettingsOpen(true);
  };

  const handleProfileMouseLeave = () => {
    profileTimeoutRef.current = setTimeout(() => {
        setIsSettingsOpen(false);
    }, 300);
  };



  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-20 h-screen bg-base-200 border-r border-base-300 fixed left-0 top-0 z-40 items-center py-6">
        {/* Logo - click to return to calendar */}
        <button
          type="button"
          onClick={() => onViewChange('calendar')}
          className="mb-8 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden hover:shadow-md transition-shadow border border-base-300/50"
          aria-label="reIS – vylepšená verze IS MENDELU"
          title="reIS – vylepšená verze IS MENDELU • Klikněte pro návrat na rozvrh"
        >
          <img src={MENDELU_LOGO_PATH} alt="Mendelu Logo" className="w-8 h-8 object-contain" />
        </button>

        {/* Navigation Items */}
        <div className="flex flex-col gap-3 w-full px-2">
          {mainMenuItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isActive={currentView === 'exams' && item.id === 'exams' || currentView === 'calendar' && item.id === 'dashboard'}
              isHovered={hoveredItem === item.id}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (item.id === 'dashboard') {
                  onViewChange('calendar');
                } else if (item.id === 'exams') {
                  onViewChange('exams');
                } else if (item.id === 'tutorials') {
                  onOpenTutorials?.();
                } else if (item.href) {
                  window.open(item.href, '_blank');
                }
              }}
              onViewChange={onViewChange}
            />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2 mb-2 w-full px-2 items-center relative" ref={settingsRef}>
          
          {/* Teams Link */}
          <a href="https://teams.microsoft.com" target="_blank" rel="noopener noreferrer" className="w-12 h-auto py-2 rounded-xl flex flex-col items-center justify-center text-base-content/50 hover:bg-base-100 hover:text-info hover:shadow-sm transition-all mx-auto group">
            <img src={TEAMS_ICON_PATH} alt="Teams" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform" />
            <span className="text-[10px] mt-1 font-medium">Teams</span>
          </a>

          {/* Outlook Link */}
          <a href="https://outlook.office.com" target="_blank" rel="noopener noreferrer" className="w-12 h-auto py-2 rounded-xl flex flex-col items-center justify-center text-base-content/50 hover:bg-base-100 hover:text-info hover:shadow-sm transition-all mx-auto group">
            <img src={OUTLOOK_ICON_PATH} alt="Outlook" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform" />
            <span className="text-[10px] mt-1 font-medium">Outlook</span>
          </a>

          {/* Divider */}
          <div className="h-px bg-base-300 w-full my-1" />

           {/* Profile / Settings Button */}
           <div 
             className="relative"
             onMouseEnter={handleProfileMouseEnter}
             onMouseLeave={handleProfileMouseLeave}
           >
            <button
              className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all mx-auto ${
                isSettingsOpen 
                  ? 'bg-primary text-primary-content shadow-md' 
                  : 'text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">Profil</span>
            </button>
            
            <div 
              onMouseEnter={handleProfileMouseEnter} // Keep open when hovering popup (clears timeout)
              onMouseLeave={handleProfileMouseLeave} // Start timeout when leaving popup
            >
                <ProfilePopup 
                isOpen={isSettingsOpen} 
                onOpenFeedback={() => {
                    console.log('Sidebar: Opening Feedback');
                    setIsSettingsOpen(false);
                    onOpenFeedback();
                }}
                />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};