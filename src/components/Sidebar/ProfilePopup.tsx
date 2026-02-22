import { motion, AnimatePresence } from 'motion/react';
import { Moon, MessageSquarePlus, Languages, Coffee } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useOutlookSync } from '../../hooks/data';
import { useTheme } from '../../hooks/useTheme';
import { useSpolkySettings } from '../../hooks/useSpolkySettings';
import { SpolkySection } from './Profile/SpolkySection';
import { OutlookSyncToggle } from './Profile/OutlookSyncToggle';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useUserParams } from '../../hooks/useUserParams';
import { User, Mail, Hash, Building2 } from 'lucide-react';
import { openPopup } from '../../api/proxyClient';
import { BalanceSection } from './Profile/BalanceSection';

export function ProfilePopup({ isOpen, onOpenFeedback }: { isOpen: boolean; onOpenFeedback?: () => void }) {
  const { isEnabled, isLoading: syncLoading, toggle: tSync } = useOutlookSync(), { isDark, isLoading: tLoading, toggle: tTheme } = useTheme(), { isSubscribed, toggleAssociation } = useSpolkySettings(), [spolkyOpen, setSpolkyOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => setIsTopUpOpen((e as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener('reis:popup-state', handler);
    return () => window.removeEventListener('reis:popup-state', handler);
  }, []);
  const { t } = useTranslation();
  const language = useAppStore(state => state.language);
  const setLanguage = useAppStore(state => state.setLanguage);
  const { params } = useUserParams();
  
  if (!isOpen) return null;
  return (
    <AnimatePresence><motion.div initial={{ opacity: 0, x: 10, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.95 }} className="absolute left-14 bottom-0 w-80 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-3 z-50">
        <div className="px-1 pt-1 pb-3 border-b border-base-200">
            <h3 className="font-bold text-base mb-3 ">{t('sidebar.profile')}</h3>
            {params && (
                <div className="flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center gap-3 text-base-content/90">
                        <User size={16} className="text-base-content/40" />
                        <span className="font-semibold text-sm truncate">{params.fullName}</span>
                    </div>
                    {params.email && (
                        <div className="flex items-center gap-3 text-base-content/60">
                            <Mail size={16} className="text-base-content/30" />
                            <span className="truncate opacity-80">{params.email}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-base-content/60">
                        <Hash size={16} className="text-base-content/30" />
                        <span className="opacity-70">{t('settings.studentId')}</span>
                        <span className="font-mono text-xs bg-base-300/50 px-2.5 py-1 rounded-lg border border-base-300/50 select-all ml-auto">{params.studentId}</span>
                    </div>
                    <BalanceSection
                        isTopUpOpen={isTopUpOpen}
                        onTopUp={() => openPopup('https://webiskam.mendelu.cz/Platby/NabitiKonta/0')}
                    />
                    <div className="flex items-center gap-3 text-base-content/60">
                        <Building2 size={16} className="text-base-content/30" />
                        <span className="opacity-70">{t('settings.dormAdmin')}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); openPopup('https://webiskam.mendelu.cz/InformaceOKlientovi'); }}
                            className="font-mono text-xs bg-success/20 text-success px-2.5 py-1 rounded-lg border border-success/30 ml-auto hover:bg-success/30 transition-colors"
                        >
                            {isTopUpOpen ? <span className="loading loading-spinner loading-xs" /> : `${t('settings.open')} →`}
                        </button>
                    </div>
                </div>
            )}
        </div>
        {/* Preferences Section */}
        <div className="py-1 border-b border-base-200">
            <div className="flex items-center justify-between gap-3 px-1 py-2 hover:bg-base-200 rounded-lg group transition-colors">
                <div className="flex items-center gap-2 flex-1">
                    <Languages size={16} className="text-base-content/50" />
                    <span className="text-xs opacity-70">{t('settings.language')}</span>
                </div>
                <div className="join bg-base-300/50 p-0.5 rounded-lg border border-base-300">
                    <button 
                        onClick={() => setLanguage('cz')} 
                        className={`join-item btn btn-xs border-none h-6 min-h-0 ${language === 'cz' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}
                    >
                        CZ
                    </button>
                    <button 
                        onClick={() => setLanguage('en')} 
                        className={`join-item btn btn-xs border-none h-6 min-h-0 ${language === 'en' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}
                    >
                        EN
                    </button>
                </div>
            </div>
            <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer hover:bg-base-200 rounded-lg">
                <div className="flex items-center gap-2 flex-1">
                    <Moon size={16} className="text-base-content/50" />
                    <span className="text-xs opacity-70">{t('settings.darkMode')}</span>
                </div>
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={isDark} disabled={tLoading} onChange={tTheme} />
            </label>
        </div>

        {/* Services Section */}
        <div className="py-1 border-b border-base-200">
            <SpolkySection expanded={spolkyOpen} onToggle={() => setSpolkyOpen(!spolkyOpen)} isSub={isSubscribed} onToggleAssoc={toggleAssociation} />
            <OutlookSyncToggle enabled={isEnabled} loading={syncLoading} onToggle={tSync} />
        </div>

        {/* Support Section */}
        <div className="py-1">
            {onOpenFeedback && (
                <button onClick={onOpenFeedback} className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors">
                    <MessageSquarePlus size={16} className="text-base-content/50" />
                    <span className="text-xs font-medium opacity-70">{t('settings.reportBug')}</span>
                </button>
            )}
            <a href="https://buymeacoffee.com/reis.mendelu" target="_blank" rel="noopener noreferrer" className="mt-2 mx-1 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-base-200 border border-base-300 hover:border-primary/30 hover:bg-primary/5 transition-all text-center group shadow-sm">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Coffee size={16} className="group-hover:scale-110 transition-transform" />
                    <span>{t('settings.buyCoffeeTitle')}</span>
                </div>
            </a>
        </div>
    </motion.div></AnimatePresence>
  );
}
