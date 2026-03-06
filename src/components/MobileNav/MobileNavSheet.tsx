import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';

interface MobileNavSheetProps {
  item: MenuItem | null;
  onClose: () => void;
  onViewChange: (view: AppView) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
  onOpenProfile?: () => void;
}

export function MobileNavSheet({ item, onClose, onViewChange, onOpenSubject, onOpenProfile }: MobileNavSheetProps) {
  if (!item) return null;

  const handleChildClick = (child: NonNullable<MenuItem['children']>[number]) => {
    if (child.id === 'zapisy-zkousky') {
      onViewChange('exams');
    } else if (child.id === 'studijni-plany') {
      onViewChange('study-program' as AppView);
    } else if (child.isSubject && child.courseCode) {
      onOpenSubject?.(child.courseCode, child.label, child.subjectId);
    } else if (child.id === 'profile-action') {
      onOpenProfile?.();
    } else if (child.href) {
      window.open(child.href, '_blank');
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 rounded-t-2xl shadow-lg max-h-[70vh] flex flex-col"
          >
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-base-300" />
            </div>
            <div className="px-4 pb-2 pt-1">
              <h3 className="font-bold text-base">{item.popupLabel || item.label}</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {!item.children || item.children.length === 0 ? (
                <div className="flex flex-col gap-1 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-3">
                      <div className="skeleton w-4 h-4 rounded" />
                      <div className="skeleton h-3 rounded flex-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {item.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => handleChildClick(child)}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-base-content/70 hover:bg-base-200 active:bg-base-200 transition-colors w-full text-left"
                    >
                      {child.icon ? (
                        <span className="text-base-content/50">
                          {child.icon}
                        </span>
                      ) : null}
                      <span className="font-medium truncate flex-1">{child.label}</span>
                      {!child.isFeature && !child.isSubject && (
                        <ExternalLink className="w-3 h-3 text-base-content/30" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
