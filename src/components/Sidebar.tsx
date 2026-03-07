import { useState, useRef } from 'react';
import { MENDELU_LOGO_PATH } from '../constants/icons';
import type { AppView } from '../types/app';
import { NavItem } from './Sidebar/NavItem';
import { BottomActions } from './Sidebar/BottomActions';
import { useMenuItems } from '../hooks/ui/useMenuItems';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (v: AppView) => void;
  onOpenFeedback?: () => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
}

export const Sidebar = ({ currentView, onViewChange, onOpenFeedback, onOpenSubject }: SidebarProps) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuItems = useMenuItems({ interleaveColumns: true });

  const handleEnter = (id: string) => { if (timeout.current) clearTimeout(timeout.current); setHovered(id); };
  const handleLeave = () => { timeout.current = setTimeout(() => setHovered(null), 300); };

  return (
    <aside className="hidden md:flex flex-col w-20 h-screen bg-base-200 border-r border-base-300 items-center py-6 shrink-0 relative z-40">
      <button onClick={() => onViewChange('calendar')} className="mb-8 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-base-300/50 hover:shadow-md transition-shadow">
        <img src={MENDELU_LOGO_PATH} alt="Logo" className="w-8 h-8 object-contain" />
      </button>
      <div className="flex flex-col gap-3 w-full px-2">
        {menuItems.map(item => (
          <NavItem key={item.id} item={item} isActive={(currentView === 'exams' && item.id === 'exams') || (currentView === 'calendar' && item.id === 'dashboard') || (currentView === 'subjects' && item.id === 'subjects')} isHovered={hovered === item.id} onMouseEnter={() => handleEnter(item.id)} onMouseLeave={handleLeave} onClick={() => { if (item.id === 'dashboard') onViewChange('calendar'); else if (item.id === 'exams') onViewChange('exams'); else if (item.id === 'subjects') onViewChange('subjects'); else if (item.href) window.open(item.href, '_blank'); }} onViewChange={onViewChange} onOpenSubject={onOpenSubject} />
        ))}
      </div>
      <div className="flex-1" />
      <BottomActions onOpenFeedback={onOpenFeedback} />
    </aside>
  );
};
