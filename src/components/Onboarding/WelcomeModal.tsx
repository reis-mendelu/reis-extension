/**
 * Welcome Modal Component
 * 
 * One-time centered popup welcoming new users to reIS.
 * Shows once, dismisses permanently via IndexedDB.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MENDELU_LOGO_PATH } from '../../constants/icons';
import { IndexedDBService } from '../../services/storage';


export function WelcomeModal() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        async function checkWelcome() {
            try {
                // Only show if not previously dismissed
                const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
                if (!dismissed) {
                    // Small delay for smoother appearance after page load
                    const timer = setTimeout(() => setIsVisible(true), 800);
                    return () => clearTimeout(timer);
                }
            } catch (err) {
                console.error('[WelcomeModal] Failed to check status:', err);
            }
        }
        checkWelcome();
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        IndexedDBService.set('meta', 'welcome_dismissed', true).catch(console.error);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
                        onClick={handleDismiss}
                    />
                    
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-sm"
                    >
                        <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden text-center p-8">
                            {/* Icon - Kept small as requested */}
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-6 shadow-md border border-base-200">
                                <img src={MENDELU_LOGO_PATH} alt="Mendelu Logo" className="w-8 h-8 object-contain" />
                            </div>
                            
                            {/* Title - Smaller */}
                            <h2 className="text-2xl font-bold text-base-content mb-3">
                                Vítej v reISu!
                            </h2>
                            
                            {/* Description - Smaller text/spacing */}
                            <p className="text-base-content/70 mb-8 leading-relaxed">
                                Vylepšená verze IS MENDELU.<br />
                                Vytvořeno studenty pro studenty.
                            </p>
                            
                            {/* CTA Button - Standard size */}
                            <button
                                onClick={handleDismiss}
                                className="btn btn-primary btn-wide gap-2 shadow-md"
                            >
                                Začít používat
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
