import { useState } from 'react';
import { Home, CalendarCheck, Book, User, Settings, Menu } from 'lucide-react';
import type { AppView } from '../../types/app';
import type { MenuItem } from '../menuConfig';
import { useMenuItems } from '../../hooks/ui/useMenuItems';
import { useTranslation } from '../../hooks/useTranslation';
import { MobileNavSheet } from './MobileNavSheet';
import { MobileProfileSheet } from './MobileProfileSheet';

interface MobileBottomNavProps {
  currentView: AppView;
  onViewChange: (v: AppView) => void;
  onOpenFeedback?: () => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  dashboard: <Home className="w-5 h-5" />,
  exams: <CalendarCheck className="w-5 h-5" />,
  subjects: <Book className="w-5 h-5" />,
  is: <User className="w-5 h-5" />,
};

export function MobileBottomNav({ currentView, onViewChange, onOpenFeedback, onOpenSubject }: MobileBottomNavProps) {
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuItems = useMenuItems();
  const { t } = useTranslation();

  const viceMenuItem: MenuItem = {
      id: 'vice',
      label: t('sidebar.more'),
      icon: <Settings className="w-5 h-5" />,
      children: [
          {
              id: 'teams-link',
              label: 'Teams',
              href: 'https://teams.microsoft.com',
          },
          {
              id: 'outlook-link',
              label: 'Outlook',
              href: 'https://outlook.office.com',
          },
          {
              id: 'profile-action',
              label: t('sidebar.profile'),
              isFeature: true,
          }
      ]
  };

  // Derive current sheet item from activeSheetId
  const sheetItem = activeSheetId === 'vice' 
    ? viceMenuItem 
    : menuItems.find(m => m.id === activeSheetId) || null;

  const tabs = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: TAB_ICONS.dashboard },
    { id: 'exams', label: t('sidebar.exams'), icon: TAB_ICONS.exams },
    { id: 'subjects', label: t('sidebar.subjects'), icon: TAB_ICONS.subjects },
    { id: 'is', label: t('sidebar.is'), icon: TAB_ICONS.is },
    { id: 'vice', label: t('sidebar.more'), icon: <Menu className="w-5 h-5" /> },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'dashboard') {
      onViewChange('calendar');
    } else if (tabId === 'exams') {
      onViewChange('exams');
    } else if (tabId === 'subjects') {
      onViewChange('subjects');
    } else if (tabId === 'is') {
       setActiveSheetId('is');
    } else if (tabId === 'profile') {
      setProfileOpen(true);
    } else if (tabId === 'vice') {
       setActiveSheetId('vice');
    } else {
      const item = menuItems.find(m => m.id === tabId);
      if (item?.expandable) {
        setActiveSheetId(item.id);
      }
    }
  };

  const isActive = (tabId: string) => {
    if (tabId === 'dashboard') return currentView === 'calendar';
    if (tabId === 'exams') return currentView === 'exams';
    if (tabId === 'subjects') return currentView === 'subjects';
    if (tabId === 'is') return activeSheetId === 'is';
    if (tabId === 'vice') return activeSheetId === 'vice' || profileOpen;
    return false;
  };

  const getBadge = (tabId: string) => {
    return menuItems.find(m => m.id === tabId)?.badge;
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-base-200 border-t border-base-300">
        <div className="flex items-center justify-around h-16 px-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive(tab.id)
                  ? 'text-primary'
                  : 'text-base-content/50 active:text-base-content'
              }`}
            >
              <div className="relative flex items-center justify-center z-10">
                {tab.icon}
                {getBadge(tab.id) !== undefined && (
                  <span className="absolute -top-2 -right-3 bg-base-content/10 text-base-content/50 font-medium px-1 rounded text-[9px] leading-[14px]">
                    {getBadge(tab.id)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <MobileNavSheet
        item={sheetItem}
        onClose={() => setActiveSheetId(null)}
        onViewChange={onViewChange}
        onOpenSubject={onOpenSubject}
        onOpenProfile={() => setProfileOpen(true)}
      />

      <MobileProfileSheet
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenFeedback={onOpenFeedback}
      />
    </>
  );
}
