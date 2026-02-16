import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Info, Calendar, ExternalLink } from 'lucide-react';
import { MENDELU_LOGO_PATH } from '../../constants/icons';
import { IndexedDBService } from '../../services/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { useOutlookSync } from '../../hooks/data/useOutlookSync';
import { useAppStore } from '../../store/useAppStore';

export function WelcomeModal() {
    const [isVisible, setIsVisible] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const { t, language } = useTranslation();
    const setLanguage = useAppStore(state => state.setLanguage);
    const { isEnabled, toggle, isLoading } = useOutlookSync();

    useEffect(() => {
        async function checkWelcome() {
            try {
                const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
                if (!dismissed) {
                    const timer = setTimeout(() => setIsVisible(true), 800);
                    return () => clearTimeout(timer);
                }
            } catch (err) {
                console.error('[WelcomeModal] Failed to check status:', err);
            }
        }
        checkWelcome();
    }, []);

    const handleNext = () => {
        if (isEnabled) {
            handleDismiss();
        } else {
            setStep(2);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        IndexedDBService.set('meta', 'welcome_dismissed', true).catch(console.error);
    };


    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
                        onClick={handleDismiss}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-xs sm:max-w-sm"
                    >
                        <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-200 overflow-hidden p-6 flex flex-col gap-4">
                            <AnimatePresence mode="wait">
                                {step === 1 ? (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="text-center"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md border border-base-200">
                                            <img src={MENDELU_LOGO_PATH} alt="Mendelu Logo" className="w-8 h-8 object-contain" />
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
                                ) : (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="flex flex-col items-center text-center gap-6"
                                    >
                                        <div className="relative">
                                            <img 
                                                src="/calendar_phone.png" 
                                                alt="Phone Sync" 
                                                className="w-48 h-auto rounded-2xl shadow-xl border border-base-content/10 relative z-10"
                                            />
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-bold text-base-content tracking-tight">{t('onboarding.syncTitle')}</h3>
                                            <p className="text-sm text-base-content/50">{t('onboarding.syncSocialProof')}</p>
                                        </div>

                                        <div className="w-full flex items-center justify-between py-2.5 px-4 bg-base-200/50 rounded-2xl border border-transparent">
                                            <div className="flex flex-col items-start translate-y-0.5">
                                                <span className="text-sm font-semibold">{t('onboarding.syncToggle')}</span>
                                                <span className="text-xs text-base-content/40 font-medium">{t('onboarding.syncDescription')}</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                className="toggle toggle-primary"
                                                checked={!!isEnabled}
                                                onChange={toggle}
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <AnimatePresence>
                                            {isEnabled && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="w-full"
                                                >
                                                    <p className="text-sm text-base-content/50 italic font-medium">
                                                        {t('onboarding.syncCoffeeBreak')}
                                                    </p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <button
                                            onClick={handleDismiss}
                                            className="btn btn-primary btn-md w-full rounded-xl mt-2 font-bold tracking-wide shadow-lg shadow-primary/20"
                                        >
                                            {t('common.close')}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
