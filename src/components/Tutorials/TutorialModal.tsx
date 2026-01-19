/**
 * TutorialModal Component
 * 
 * Full-screen modal for viewing tutorials with slide navigation.
 * Similar to WelcomeModal but with multi-slide support.
 */

import { useState, useCallback } from 'react';
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
  
  const totalSlides = tutorial.slides.length;
  const currentSlide = tutorial.slides[currentSlideIndex];
  const isFirstSlide = currentSlideIndex === 0;
  const isLastSlide = currentSlideIndex === totalSlides - 1;

  const goToPrevious = useCallback(() => {
    if (!isFirstSlide) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  }, [isFirstSlide]);

  const goToNext = useCallback(() => {
    if (!isLastSlide) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [isLastSlide, onClose]);

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[90%] max-w-4xl h-[85vh] flex flex-col"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 flex flex-col h-full overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-100/80 backdrop-blur shrink-0">
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
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlideIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
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
                
                {/* Progress Dots */}
                <div className="flex items-center gap-2">
                  {tutorial.slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        index === currentSlideIndex
                          ? 'bg-primary w-6'
                          : 'bg-base-300 hover:bg-base-content/30'
                      }`}
                      aria-label={`Slide ${index + 1}`}
                    />
                  ))}
                </div>
                
                {/* Next/Finish Button */}
                <button
                  onClick={goToNext}
                  className="btn btn-primary gap-2"
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
