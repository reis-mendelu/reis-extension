/**
 * TutorialModal Component
 * 
 * Full-screen modal for viewing tutorials with slide navigation.
 * Similar to WelcomeModal but with multi-slide support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Tutorial } from '../../services/tutorials/types';
import { TutorialSlide } from './TutorialSlide';

interface TutorialModalProps {
  tutorial: Tutorial;
  isOpen: boolean;
  onClose: () => void;
}

export function TutorialModal({ tutorial, isOpen, onClose }: TutorialModalProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const totalSlides = tutorial.slides.length;
  const currentSlide = tutorial.slides[currentSlideIndex];
  const isFirstSlide = currentSlideIndex === 0;
  const isLastSlide = currentSlideIndex === totalSlides - 1;

  // Auto-focus the modal when it opens to enable immediate keyboard navigation
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure the modal is in the DOM and visible
      const timer = setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const goToPrevious = useCallback(() => {
    if (!isFirstSlide) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  }, [isFirstSlide]);

  const goToNext = useCallback(() => {
    if (!isLastSlide) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  }, [isLastSlide]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlideIndex(index);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'Escape') onClose();
  }, [goToPrevious, goToNext, onClose]);

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
          
          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[90%] max-w-4xl aspect-[4/3] max-h-[90vh] flex flex-col outline-none overflow-hidden"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 flex flex-col h-full overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-white/40 bg-base-100/80 backdrop-blur shrink-0 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-base-content">
                    {tutorial.title}
                  </h2>
                  {tutorial.description && (
                    <p className="text-sm text-base-content/60 mt-0.5">
                      {tutorial.description}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={onClose}
                  className="btn btn-ghost btn-circle"
                  aria-label="Zavřít"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Slide Content */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlideIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    {currentSlide && <TutorialSlide slide={currentSlide} />}
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Footer with Navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-100/80 backdrop-blur shrink-0">
                
                {/* Previous Button */}
                <button
                  onClick={goToPrevious}
                  disabled={isFirstSlide}
                  className="btn btn-ghost gap-2 disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Zpět</span>
                </button>
                
                {/* Progress Indicators */}
                <div className="flex flex-col items-center gap-1.5">
                  {/* Dots */}
                  <div className="flex items-center gap-2">
                    {tutorial.slides.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentSlideIndex
                            ? 'bg-primary w-3'
                            : 'bg-base-content/20 hover:bg-base-content/40'
                        }`}
                        aria-label={`Snímek ${index + 1}`}
                      />
                    ))}
                  </div>
                  
                  {/* Step Label */}
                  <span className="text-xs font-medium text-base-content/50 uppercase tracking-wider">
                    Snímek {currentSlideIndex + 1} z {totalSlides}
                  </span>
                </div>
                
                {/* Next/Finish Button */}
                <button
                  onClick={isLastSlide ? onClose : goToNext}
                  className="btn btn-primary gap-2 min-w-[120px]"
                >
                  <span>{isLastSlide ? 'Dokončit' : 'Další'}</span>
                  {!isLastSlide && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
              
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
