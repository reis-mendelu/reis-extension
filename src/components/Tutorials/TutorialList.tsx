/**
 * TutorialList Component
 * 
 * Displays available tutorials for the user to select.
 * Shown when user clicks "Průvodce" in sidebar.
 */

import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, ChevronRight, X, Layers } from 'lucide-react';
import type { Tutorial } from '../../services/tutorials/types';

interface TutorialListProps {
  tutorials: Tutorial[];
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onSelectTutorial: (tutorial: Tutorial) => void;
}

export function TutorialList({ 
  tutorials, 
  isOpen, 
  isLoading,
  onClose, 
  onSelectTutorial 
}: TutorialListProps) {
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-md"
          >
            <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-base-content">
                    Průvodce
                  </h2>
                </div>
                
                <button
                  onClick={onClose}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Zavřít"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-4 max-h-96 overflow-y-auto">
                {isLoading ? (
                  // Loading skeleton
                  <div className="space-y-3">
                    {[1, 2].map(i => (
                      <div key={i} className="skeleton h-20 w-full rounded-xl opacity-30" />
                    ))}
                  </div>
                ) : tutorials.length === 0 ? (
                  // Empty state
                  <div className="text-center py-12">
                    <Layers className="w-12 h-12 mx-auto mb-4 text-base-content/20" />
                    <p className="text-base-content/60">
                      Zatím žádné tutoriály
                    </p>
                    <p className="text-sm text-base-content/40 mt-1">
                      Vrať se později
                    </p>
                  </div>
                ) : (
                  // Tutorial list
                  <div className="space-y-3">
                    {tutorials.map((tutorial) => (
                      <button
                        key={tutorial.id}
                        onClick={() => onSelectTutorial(tutorial)}
                        className="w-full text-left p-4 rounded-xl border border-base-300 bg-base-100 hover:bg-base-200 hover:border-primary/30 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base-content group-hover:text-primary transition-colors truncate">
                              {tutorial.title}
                            </h3>
                            {tutorial.description && (
                              <p className="text-sm text-base-content/60 mt-1 line-clamp-2">
                                {tutorial.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-base-content/40">
                              <Layers className="w-3 h-3" />
                              <span>{tutorial.slides.length} snímků</span>
                            </div>
                          </div>
                          
                          <ChevronRight className="w-5 h-5 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
