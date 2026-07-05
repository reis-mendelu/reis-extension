import { motion, AnimatePresence } from 'motion/react';
import { Moon, MessageSquarePlus, Languages, User, Mail, Hash, LogOut, Bug } from 'lucide-react';
import { useState } from 'react';

import { useOutlookSync } from '../../hooks/data';
import { useTheme } from '../../hooks/useTheme';
import { useSpolkySettings } from '../../hooks/useSpolkySettings';
import { SpolkySection } from '../Sidebar/Profile/SpolkySection';
import { OutlookSyncToggle } from '../Sidebar/Profile/OutlookSyncToggle';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useIskamStore } from '../../store/iskamStore';
import { useUserParams } from '../../hooks/useUserParams';
import { logout } from '../../api/proxyClient';
import { useTripleClick } from '../../hooks/ui/useTripleClick';

interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFeedback?: () => void;
  isIskam?: boolean;
}

export function MobileProfileSheet({ isOpen, onClose, onOpenFeedback, isIskam }: MobileProfileSheetProps) {
  const { isEnabled, isLoading: syncLoading, toggle: tSync } = useOutlookSync();
  const { isDark, isLoading: tLoading, toggle: tTheme } = useTheme();
  const { isSubscribed, toggleAssociation } = useSpolkySettings();
  const [spolkyOpen, setSpolkyOpen] = useState(false);
  const { t } = useTranslation();
  const language = useAppStore(state => state.language);
  const setLanguage = useAppStore(state => state.setLanguage);
  const errorReportingEnabled = useAppStore(state => state.errorReportingEnabled);
  const setErrorReportingEnabled = useAppStore(state => state.setErrorReportingEnabled);
  const openSocietyAdmin = useAppStore(s => s.openSocietyAdmin);
  const onBadge = useTripleClick(openSocietyAdmin);
  const { params } = useUserParams();

  const data = useIskamStore(s => s.data);
  const iskamProfile = data?.profile;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 rounded-t-2xl shadow-lg max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-base-300" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="pt-1 pb-3 border-b border-base-200">
                <h3 className="font-bold text-base mb-3">{t('sidebar.profile')}</h3>
                
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
                      <span onClick={onBadge} className="opacity-70">{t('settings.studentId')}</span>
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

              <div className="py-1 border-b border-base-200">
                <div className="flex items-center justify-between gap-3 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    <Languages size={16} className="text-base-content/50" />
                    <span className="text-xs opacity-70">{t('settings.language')}</span>
                  </div>
                  <div className="join bg-base-300/50 p-0.5 rounded-lg border border-base-300">
                    <button onClick={() => setLanguage('cz')} className={`join-item btn btn-xs border-none h-6 min-h-0 ${language === 'cz' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}>CZ</button>
                    <button onClick={() => setLanguage('en')} className={`join-item btn btn-xs border-none h-6 min-h-0 ${language === 'en' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}>EN</button>
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
              </div>

              {!isIskam && (
                <div className="py-1 border-b border-base-200">
                  <SpolkySection expanded={spolkyOpen} onToggle={() => setSpolkyOpen(!spolkyOpen)} isSub={isSubscribed} onToggleAssoc={toggleAssociation} />
                  <OutlookSyncToggle enabled={isEnabled} loading={syncLoading} onToggle={tSync} />
                </div>
              )}

              <div className="py-1">
                {!isIskam && onOpenFeedback && (
                  <button onClick={() => { onClose(); onOpenFeedback(); }} className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors">
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
