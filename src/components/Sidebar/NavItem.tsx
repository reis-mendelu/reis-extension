import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink, Plus, X } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { PagePinnerModal } from './PagePinnerModal';

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onViewChange: (view: AppView) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
}

export function NavItem({ item, isActive, isHovered, onMouseEnter, onMouseLeave, onClick, onViewChange, onOpenSubject }: NavItemProps) {
  const [pinnerOpen, setPinnerOpen] = useState(false);
  const pinnedPages = useAppStore(s => s.pinnedPages);
  const unpinPage = useAppStore(s => s.unpinPage);
  const { t } = useTranslation();

  const hasPinnedChildren = item.id === 'is' && item.children?.some(c => c.isPinned);
  const canAddMore = pinnedPages.length < 6;

  return (
    <div
      className="relative group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        onClick={onClick}
        className={`relative w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
          ${isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
          }`}
      >
        {item.href && !item.expandable && item.id !== 'dashboard' && (
          <ExternalLink className="absolute top-1 right-1 w-2.5 h-2.5 text-base-content/30" />
        )}
        <div className="relative flex items-center justify-center">
          {item.icon}
          {item.badge !== undefined && (
            <span className="absolute -top-2 -right-3 bg-base-content/10 text-base-content/50 font-medium px-1 rounded text-[9px] leading-[14px]">
              {item.badge}
            </span>
          )}
        </div>
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
                item.id === 'subjects' && item.children && item.children.length > 4 ? 'w-[500px] max-w-[calc(100vw-5rem)]' : 'w-64 max-w-[calc(100vw-5rem)]'
            }`}
          >
            <div className={`gap-0.5 ${
                item.id === 'subjects' && item.children && item.children.length > 4 ? 'grid grid-cols-2' : 'flex flex-col'
            }`}>
              {!item.children || item.children.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <div className="skeleton w-4 h-4 rounded" />
                    <div className="skeleton h-3 rounded flex-1" />
                  </div>
                ))
              ) : item.children.map((child) => (
                child.isPinned ? (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200 hover:text-primary transition-colors group/item"
                  >
                    <a
                      href={child.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-base-content/50 group-hover/item:text-primary transition-colors">
                        {child.icon || <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className="font-medium truncate flex-1">{child.label}</span>
                    </a>
                    <button
                      onClick={() => unpinPage(child.id)}
                      className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover/item:opacity-100 hover:bg-error/20 hover:text-error border-none transition-all shrink-0"
                      aria-label="Unpin"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <a
                    key={child.id}
                    href={child.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (child.id === 'zapisy-zkousky') {
                        e.preventDefault();
                        onViewChange('exams');
                      } else if (child.id === 'studijni-plany') {
                        e.preventDefault();
                        onViewChange('subjects');
                      } else if (child.isSubject && child.courseCode) {
                        e.preventDefault();
                        onOpenSubject?.(child.courseCode, child.label, child.subjectId);
                      } else if (child.isFeature) {
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
                    {!child.isFeature && !child.isSubject && (
                      <ExternalLink className="w-3 h-3 text-base-content/30 group-hover/item:text-base-content/50" />
                    )}
                  </a>
                )
              ))}
            </div>

            {/* Add pin button for IS popover */}
            {item.id === 'is' && canAddMore && (
              <>
                {hasPinnedChildren && <div className="divider my-0 h-1" />}
                <button
                  onClick={(e) => { e.stopPropagation(); setPinnerOpen(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('sidebar.addPin')}</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PagePinnerModal open={pinnerOpen} onClose={() => setPinnerOpen(false)} />
    </div>
  );
}
