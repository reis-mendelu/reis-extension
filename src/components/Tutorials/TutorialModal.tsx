import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TutorialSlide } from './TutorialSlide';
import { ModalHeader } from './TutorialModal/ModalHeader';
import { ModalFooter } from './TutorialModal/ModalFooter';

import type { Tutorial } from '../../services/tutorials';

interface TutorialModalProps {
    tutorial: Tutorial;
    isOpen: boolean;
    onClose: () => void;
}

export function TutorialModal({ tutorial, isOpen, onClose }: TutorialModalProps) {
    const [idx, setIdx] = useState(0), ref = useRef<HTMLDivElement>(null), total = tutorial.slides.length;
    useEffect(() => { if (isOpen) { const t = setTimeout(() => ref.current?.focus(), 50); return () => clearTimeout(t); } }, [isOpen]);
    const prev = useCallback(() => idx > 0 && setIdx(idx - 1), [idx]), next = useCallback(() => idx < total - 1 && setIdx(idx + 1), [idx, total]);
    const key = useCallback((e: React.KeyboardEvent) => { if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); if (e.key === 'Escape') onClose(); }, [prev, next, onClose]);

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]" onClick={onClose} />
            <motion.div ref={ref} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[90%] max-w-4xl aspect-[4/3] outline-none" onKeyDown={key} tabIndex={0}>
                <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 flex flex-col h-full overflow-hidden">
                    <ModalHeader title={tutorial.title || ''} description={tutorial.description || ''} onClose={onClose} />
                    <div className="flex-1 overflow-y-auto"><AnimatePresence mode="wait"><motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0"><TutorialSlide slide={tutorial.slides[idx]} /></motion.div></AnimatePresence></div>
                    <ModalFooter curr={idx} total={total} isFirst={idx === 0} isLast={idx === total - 1} onPrev={prev} onNext={next} onGo={setIdx} onClose={onClose} />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
