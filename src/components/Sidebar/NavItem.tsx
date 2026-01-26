import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../Sidebar';
import type { Tutorial } from '../../services/tutorials/types';

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onViewChange: (view: AppView) => void;
  onSelectTutorial?: (tutorial: Tutorial) => void;
  onOpenSubject?: (courseCode: string, courseName?: string) => void;
}

export function NavItem({ item, isActive, isHovered, onMouseEnter, onMouseLeave, onClick, onViewChange, onSelectTutorial, onOpenSubject }: NavItemProps) {
  return (
    <div
      className="relative group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        onClick={onClick}
        className={`w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
          ${isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
          }`}
      >
        {item.icon}
        <span className="text-[10px] mt-1 font-medium w-full text-center px-1 leading-tight">
          {item.label}
        </span>
      </button>

      {/* Popup Menu for expandable items */}
      <AnimatePresence>
        {isHovered && item.expandable && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute left-14 -top-4 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-2 z-50 ${
                item.id === 'subjects' && item.children && item.children.length > 4 ? 'w-[500px]' : 'w-64'
            }`}
          >
            <div className={`gap-0.5 ${
                item.id === 'subjects' && item.children && item.children.length > 4 ? 'grid grid-cols-2' : 'flex flex-col'
            }`}>
              {item.children?.map((child) => (
                <a
                  key={child.id}
                  href={child.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    console.log(`[NavItem] Child clicked: ${child.label} (ID: ${child.id})`);
                    if (child.id === 'zapisy-zkousky') {
                      e.preventDefault();
                      console.log('[NavItem] Triggering view change: exams');
                      onViewChange('exams');
                    } else if (child.id === 'studijni-plany') {
                      e.preventDefault();
                      console.log('[NavItem] Triggering view change: study-program');
                      onViewChange('study-program');
                    } else if (child.isTutorial && child.tutorial) {
                      e.preventDefault();
                      console.log(`[NavItem] Triggering tutorial: ${child.tutorial.title}`);
                      onSelectTutorial?.(child.tutorial);
                    } else if (child.isSubject && child.courseCode) {
                      e.preventDefault();
                      console.log(`[NavItem] Opening subject drawer: ${child.courseCode}`);
                      onOpenSubject?.(child.courseCode, child.label);
                    } else if (child.isFeature) {
                       console.log(`[NavItem] Feature clicked but no specific handler: ${child.id}`);
                       e.preventDefault();
                    }
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200 hover:text-primary transition-colors group/item cursor-pointer"
                >
                  <span className="text-base-content/50 group-hover/item:text-primary transition-colors">
                    {child.icon || <ChevronRight className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className="font-medium truncate">{child.label}</span>
                    {child.subtitle && (
                      <span className="text-[10px] text-base-content/40 truncate">{child.subtitle}</span>
                    )}
                  </div>
                  {!child.isFeature && !child.isTutorial && (
                    <ExternalLink className="w-3 h-3 text-base-content/30 group-hover/item:text-base-content/50" />
                  )}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
