import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';
import { ReisLogo } from '../ReisLogo';
import { IndexedDBService } from '../../services/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { logError } from '../../utils/reportError';

export function WelcomeModal() {
    const [isVisible, setIsVisible] = useState(false);
    const { t, language } = useTranslation();
    const setLanguage = useAppStore(state => state.setLanguage);

    useEffect(() => {
        async function checkWelcome() {
            try {
                const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
                if (!dismissed) {
                    const timer = setTimeout(() => setIsVisible(true), 800);
                    return () => clearTimeout(timer);
                }
            } catch (err) {
                logError('WelcomeModal.checkStatus', err);
            }
        }
        checkWelcome();
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        IndexedDBService.set('meta', 'welcome_dismissed', true).catch(e => logError('WelcomeModal.dismiss', e));
    };

    const handleNext = () => handleDismiss();

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[calc(100%-2rem)] max-w-sm sm:max-w-lg"
                    >
                        <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 p-6 sm:p-8 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="text-center"
                                >
                                    <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-4 shadow-md flex items-center justify-center">
                                        <ReisLogo className="w-full h-full" />
                                    </div>
                                    <h2 className="text-xl font-bold text-base-content mb-2 tracking-tight">
                                        {t('onboarding.welcome')}
                                    </h2>
                                    <p className="text-sm text-base-content/70 mb-5 leading-relaxed">
                                        {t('onboarding.description')}
                                    </p>

                                    <div className="flex justify-center mb-6">
                                        <div className="join bg-base-300/50 p-0.5 rounded-lg border border-base-300">
                                            <button
                                                onClick={() => setLanguage('cz')}
                                                className={`join-item btn btn-xs border-none h-6 min-h-0 w-12 ${language === 'cz' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}
                                            >
                                                CZ
                                            </button>
                                            <button
                                                onClick={() => setLanguage('en')}
                                                className={`join-item btn btn-xs border-none h-6 min-h-0 w-12 ${language === 'en' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}
                                            >
                                                EN
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleNext}
                                        className="btn btn-primary btn-md btn-wide rounded-xl shadow-md gap-2"
                                    >
                                        {t('onboarding.getStarted')}
                                        <Check className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
