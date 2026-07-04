import { motion, AnimatePresence } from 'motion/react';
import { Moon, MessageSquarePlus, Languages, LogOut, Bug, ScrollText, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { StudyDocumentsPopover } from './StudyDocumentsPopover';
import { useOutlookSync } from '../../hooks/data';
import { useTheme } from '../../hooks/useTheme';
import { useSpolkySettings } from '../../hooks/useSpolkySettings';
import { SpolkySection } from './Profile/SpolkySection';
import { OutlookSyncToggle } from './Profile/OutlookSyncToggle';
import { GoogleDriveToggle } from './Profile/GoogleDriveToggle';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useUserParams } from '../../hooks/useUserParams';
import { useIskamStore } from '../../store/iskamStore';
import { User, Mail, Hash } from 'lucide-react';
import { logout } from '../../api/proxyClient';
import { HiddenItemsSection } from './Profile/HiddenItemsSection';

export function ProfilePopup({ isOpen, onOpenFeedback, isIskam }: { isOpen: boolean; onOpenFeedback?: () => void; isIskam?: boolean }) {
  const { isEnabled, isLoading: syncLoading, toggle: tSync } = useOutlookSync(), { isDark, isLoading: tLoading, toggle: tTheme } = useTheme(), { isSubscribed, toggleAssociation } = useSpolkySettings(), [spolkyOpen, setSpolkyOpen] = useState(false), [docsOpen, setDocsOpen] = useState(false);
  const data = useIskamStore(s => s.data);
  const iskamProfile = data?.profile;

  const { t } = useTranslation();
  const language = useAppStore(state => state.language);
  const setLanguage = useAppStore(state => state.setLanguage);
  const errorReportingEnabled = useAppStore(state => state.errorReportingEnabled);
  const setErrorReportingEnabled = useAppStore(state => state.setErrorReportingEnabled);
  const { params } = useUserParams();
  
  if (!isOpen) return null;
  return (
    <AnimatePresence><motion.div initial={{ opacity: 0, x: 10, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.95 }} className="absolute left-14 bottom-0 w-80 max-w-[calc(100vw-5rem)] bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-3 z-50">
        <div className="px-1 pt-1 pb-3 border-b border-base-200">
            <h3 className="font-bold text-base mb-3 ">{t('sidebar.profile')}</h3>
            
            {/* IS MENDELU Profile Info */}
            {params && !isIskam && (
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
                </div>
            )}

            {/* WebISKAM Profile Info */}
            {isIskam && iskamProfile && (
                <div className="flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center gap-3 text-base-content/90">
                        <User size={16} className="text-base-content/40" />
                        <span className="font-semibold text-sm truncate">{iskamProfile.fullName}</span>
                    </div>
                    {iskamProfile.email && (
                        <div className="flex items-center gap-3 text-base-content/60">
                            <Mail size={16} className="text-base-content/30" />
                            <span className="truncate opacity-80">{iskamProfile.email}</span>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Study documents — quick print/download (IS Mendelu only) */}
        {!isIskam && (
            <div className="py-1 border-b border-base-200">
                <button
                    onClick={() => setDocsOpen(true)}
                    className="w-full flex items-center gap-3 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors group"
                >
                    <ScrollText size={16} className="text-base-content/50 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium opacity-70 group-hover:opacity-100">{t('studyDocs.trigger')}</span>
                    <ChevronRight size={14} className="ml-auto text-base-content/30 group-hover:text-base-content/60" />
                </button>
            </div>
        )}

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
            <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer hover:bg-base-200 rounded-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Bug size={16} className="text-base-content/50 shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs opacity-70">{t('settings.errorReporting')}</span>
                        <span className="text-[10px] opacity-50 truncate">{t('settings.errorReportingDesc')}</span>
                    </div>
                </div>
                <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={errorReportingEnabled}
                    onChange={(e) => setErrorReportingEnabled(e.target.checked)}
                />
            </label>
            {!isIskam && <HiddenItemsSection />}
        </div>

        {/* Services Section - Hidden in ISKAM */}
        {!isIskam && (
            <div className="py-1 border-b border-base-200">
                <SpolkySection expanded={spolkyOpen} onToggle={() => setSpolkyOpen(!spolkyOpen)} isSub={isSubscribed} onToggleAssoc={toggleAssociation} />
                <OutlookSyncToggle enabled={isEnabled} loading={syncLoading} onToggle={tSync} />
                <GoogleDriveToggle />
            </div>
        )}

        {/* Support Section */}
        <div className="py-1">
            {!isIskam && onOpenFeedback && (
                <button onClick={onOpenFeedback} className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors">
                    <MessageSquarePlus size={16} className="text-base-content/50" />
                    <span className="text-xs font-medium opacity-70">{t('settings.reportBug')}</span>
                </button>
            )}
            
            <div className="flex items-center gap-3 px-1 py-1.5 text-base-content/60">
                <LogOut size={16} className="text-base-content/30" />
                <span className="text-xs font-medium opacity-70">{t('settings.logout')}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); logout(); }}
                    className="font-mono text-xs bg-error/20 text-error px-2.5 py-1 rounded-lg border border-error/30 ml-auto hover:bg-error/30 transition-colors"
                >
                    {t('settings.logout')} →
                </button>
            </div>

        </div>
    </motion.div>
    <StudyDocumentsPopover isOpen={docsOpen} onClose={() => setDocsOpen(false)} />
    </AnimatePresence>
  );
}
