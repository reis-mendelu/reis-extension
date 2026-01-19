import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, X, ChevronRight } from 'lucide-react';

const OUTLOOK_HINT_STORAGE_KEY = 'reis_outlook_hint_shown';
const OUTLOOK_HINT_NAV_THRESHOLD = 2;

interface OutlookSyncHintProps {
    /** Number of week navigations this session */
    navigationCount: number;
    /** Whether Outlook sync is currently enabled */
    isSyncEnabled: boolean | null;
    /** Called when user clicks "Nastavit" - should open settings popup */
    onSetup: () => void;
}

/**
 * Sleek, minimal toast that suggests Outlook sync.
 * Appears after 2 week navigations if sync is not enabled.
 */
export function OutlookSyncHint({ navigationCount, isSyncEnabled, onSetup }: OutlookSyncHintProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

    useEffect(() => {
        // Check if already seen
        const hasSeenHint = localStorage.getItem(OUTLOOK_HINT_STORAGE_KEY);
        if (hasSeenHint) {
            setHasBeenDismissed(true);
            return;
        }

        // Show conditions:
        // 1. Navigation count >= threshold
        // 2. Sync is NOT enabled (false, not null/loading)
        // 3. Not dismissed this session
        const shouldShow = 
            navigationCount >= OUTLOOK_HINT_NAV_THRESHOLD &&
            isSyncEnabled === false &&
            !hasBeenDismissed;

        if (shouldShow && !isVisible) {
            // Delay slightly for smoother appearance
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [navigationCount, isSyncEnabled, hasBeenDismissed, isVisible]);

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                handleDismiss();
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    // Hide if sync gets enabled
    useEffect(() => {
        if (isSyncEnabled === true && isVisible) {
            setIsVisible(false);
        }
    }, [isSyncEnabled, isVisible]);

    const handleDismiss = () => {
        setIsVisible(false);
        setHasBeenDismissed(true);
        localStorage.setItem(OUTLOOK_HINT_STORAGE_KEY, 'true');
    };

    const handleSetup = () => {
        handleDismiss();
        onSetup();
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed bottom-6 left-24 z-[100] max-w-sm" // Positioned next to sidebar
                >
                    <div className="flex items-stretch gap-3 bg-base-100 backdrop-blur-md border border-base-200 p-4 rounded-xl shadow-lg ring-1 ring-black/5 hover:shadow-xl transition-shadow">
                        {/* Icon Container */}
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        
                        {/* Text Content */}
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-sm font-semibold text-base-content whitespace-normal">Zapnout synchronizaci?</span>
                            <span className="text-xs text-base-content/60 whitespace-normal">Měj termíny a rozvrh v Outlooku</span>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 pl-3 border-l border-base-200 shrink-0">
                            <button
                                onClick={handleSetup}
                                className="btn btn-primary btn-xs btn-circle"
                                title="Nastavit"
                            >
                                <ChevronRight className="w-4 h-4 ml-0.5" />
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-base-content"
                                title="Zavřít"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
