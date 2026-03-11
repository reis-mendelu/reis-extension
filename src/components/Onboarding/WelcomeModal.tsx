import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Info } from 'lucide-react';
import { ReisLogo } from '../ReisLogo';
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
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full transition-all duration-300 ${step === 1 ? 'max-w-sm sm:max-w-lg' : 'max-w-sm md:max-w-2xl lg:max-w-3xl'}`}
                    >
                        <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 p-6 sm:p-8 flex flex-col gap-4">
                            <AnimatePresence mode="wait">
                                {step === 1 ? (
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
                                ) : (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="flex flex-col md:flex-row items-center md:items-stretch gap-8 lg:gap-12"
                                    >
                                        <div className="w-full md:w-1/2 flex items-center justify-center">
                                            <div className="relative group">
                                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                                <img 
                                                    src="/calendar_phone.png" 
                                                    alt="Phone Sync" 
                                                    className="w-full max-w-[280px] h-auto rounded-2xl shadow-2xl border border-white/10 relative z-10"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="w-full md:w-1/2 flex flex-col justify-center text-center md:text-left gap-6">
                                            <div className="space-y-3">
                                                <h3 className="text-2xl font-black text-base-content tracking-tight leading-none">{t('onboarding.syncTitle')}</h3>
                                                <p className="text-sm text-base-content/70 font-medium leading-relaxed whitespace-pre-line">{t('onboarding.syncDescription')}</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="w-full flex items-center justify-between py-3.5 px-5 bg-base-200/80 backdrop-blur-sm rounded-2xl border border-base-300/50 shadow-inner">
                                                    <div className="flex flex-col items-start translate-y-0.5">
                                                        <span className="text-sm font-bold tracking-tight">{t('onboarding.syncToggle')}</span>
                                                    </div>
                                                    <input 
                                                        type="checkbox" 
                                                        className="toggle toggle-primary toggle-md"
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
                                                            <div className="flex items-center gap-2 text-primary/80 px-1">
                                                                <Info className="w-4 h-4" />
                                                                <p className="text-xs italic font-semibold">
                                                                    {t('onboarding.syncCoffeeBreak')}
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            <button
                                                onClick={handleDismiss}
                                                className="btn btn-primary btn-lg w-full rounded-2xl font-bold tracking-wider shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                {t('common.close')}
                                            </button>
                                        </div>
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
