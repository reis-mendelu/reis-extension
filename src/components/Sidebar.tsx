import { useState, useRef } from 'react';
import { Layers } from 'lucide-react';
import { MENDELU_LOGO_PATH } from '../constants/icons';
import { getMainMenuItems } from './menuConfig';
import type { AppView } from '../types/app';
import { NavItem } from './Sidebar/NavItem';
import { BottomActions } from './Sidebar/BottomActions';
import { useSubjects } from '../hooks/data/useSubjects';
import { useUserParams } from '../hooks/useUserParams';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';

export const Sidebar = ({ currentView, onViewChange, onOpenFeedback, tutorials = [], onSelectTutorial, onOpenSubject }: { currentView: AppView, onViewChange: (v: AppView) => void, onOpenFeedback?: () => void, tutorials?: any[], onSelectTutorial?: any, onOpenSubject?: any }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const timeout = useRef<any>(null);
  const { subjects } = useSubjects();
  const { params } = useUserParams();
  const files = useAppStore(state => state.files);
  const { t } = useTranslation();

  const handleEnter = (id: string) => { if (timeout.current) clearTimeout(timeout.current); setHovered(id); };
  const handleLeave = () => { timeout.current = setTimeout(() => setHovered(null), 300); };

  const menuItems = getMainMenuItems(params?.studium ?? '', params?.obdobi ?? '', t).map(item => {
    const p = { ...item };
    if (item.id === 'tutorials' && tutorials.length > 0) {
      p.expandable = true;
      p.children = tutorials.map(t => ({ id: `tutorial-${t.id}`, label: t.title, subtitle: `${t.slides.length} snímků`, icon: <Layers className="w-4 h-4" />, isTutorial: true, tutorial: t }));
    }
    if (item.id === 'subjects' && subjects) {
      p.expandable = true;
      const sortedSubjects = Object.values(subjects.data).sort((a: any, b: any) => {
        const aHasFiles = (files[a.subjectCode]?.length ?? 0) > 0;
        const bHasFiles = (files[b.subjectCode]?.length ?? 0) > 0;

        if (aHasFiles && !bHasFiles) return -1;
        if (!aHasFiles && bHasFiles) return 1;

        const aName = a.displayName.replace(a.subjectCode, '').trim();
        const bName = b.displayName.replace(b.subjectCode, '').trim();
        return aName.localeCompare(bName);
      });

      // Interleave for column-major display in 2-column grid
      const numRows = Math.ceil(sortedSubjects.length / 2);
      const columnMajorSubjects = [];
      for (let i = 0; i < numRows; i++) {
        columnMajorSubjects.push(sortedSubjects[i]);
        if (i + numRows < sortedSubjects.length) {
          columnMajorSubjects.push(sortedSubjects[i + numRows]);
        }
      }

      p.children = columnMajorSubjects.map((s: any) => ({ 
        id: `subject-${s.subjectCode}`, 
        label: s.displayName.replace(s.subjectCode, '').trim(), 
        icon: <Layers className="w-4 h-4" />, 
        isSubject: true, 
        courseCode: s.subjectCode, 
        subjectId: s.subjectId 
      }));
    }
    return p;
  });

  return (
    <aside className="hidden md:flex flex-col w-20 h-screen bg-base-200 border-r border-base-300 fixed left-0 top-0 z-40 items-center py-6">
      <button onClick={() => onViewChange('calendar')} className="mb-8 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-base-300/50 hover:shadow-md transition-shadow">
        <img src={MENDELU_LOGO_PATH} alt="Logo" className="w-8 h-8 object-contain" />
      </button>
      <div className="flex flex-col gap-3 w-full px-2">
        {menuItems.map(item => (
          <NavItem key={item.id} item={item} isActive={(currentView === 'exams' && item.id === 'exams') || (currentView === 'calendar' && item.id === 'dashboard')} isHovered={hovered === item.id} onMouseEnter={() => handleEnter(item.id)} onMouseLeave={handleLeave} onClick={() => { if (item.id === 'dashboard') onViewChange('calendar'); else if (item.id === 'exams') onViewChange('exams'); else if (item.href) window.open(item.href, '_blank'); }} onViewChange={onViewChange} onSelectTutorial={onSelectTutorial} onOpenSubject={onOpenSubject} />
        ))}
      </div>
      <div className="flex-1" />
      <BottomActions onOpenFeedback={onOpenFeedback} />
    </aside>
  );
};