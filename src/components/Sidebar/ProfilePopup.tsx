import { motion, AnimatePresence } from 'motion/react';
import {
  Moon,
  MessageSquarePlus,
  Languages,
  LogOut,
  Wifi,
  ChevronRight,
  UserCog,
  ShieldCheck,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useUserParams } from '../../hooks/useUserParams';
import { User, Mail, Hash } from 'lucide-react';
import { logout } from '../../api/proxyClient';
import { HiddenItemsSection } from './Profile/HiddenItemsSection';
import { desktopEduroamTarget } from '../../utils/desktopEduroamTarget';
import { useLongPress } from '../../hooks/ui/useLongPress';

export function ProfilePopup({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const { isDark, isLoading: tLoading, toggle: tTheme } = useTheme();
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const openEduroamFor = useAppStore((state) => state.openEduroamFor);
  const setIsEduroamOpen = useAppStore((state) => state.setIsEduroamOpen);
  const openReport = useAppStore((state) => state.openReport);
  const isReisAdmin = useAppStore((state) => state.adminRole === 'reis_admin');
  const openImpersonationPicker = useAppStore((state) => state.openImpersonationPicker);
  const hasAdminSession = useAppStore((state) => state.adminSession !== null);
  const openSocietyAdmin = useAppStore((state) => state.openSocietyAdmin);
  const openAdmin = () => {
    openSocietyAdmin();
    onClose?.();
  };
  // The hidden door into the admin console: hold your name (spec 2026-10-08).
  const hold = useLongPress(openAdmin);
  const { params } = useUserParams();

  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 10, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 10, scale: 0.95 }}
        className="absolute left-14 bottom-0 w-80 max-w-[calc(100vw-5rem)] bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-3 z-50"
      >
        <div className="px-1 pt-1 pb-3 border-b border-base-200">
          <h3 className="font-bold text-base mb-3 ">{t('sidebar.profile')}</h3>

          {/* IS MENDELU Profile Info */}
          {params && (
            <div className="flex flex-col gap-2.5 text-xs">
              <div
                data-testid="profile-popup-name"
                {...hold}
                className="flex select-none items-center gap-3 text-base-content/90"
              >
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
                <span className="font-mono text-xs bg-base-300/50 px-2.5 py-1 rounded-lg border border-base-300/50 select-all ml-auto">
                  {params.studentId}
                </span>
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
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={isDark}
              disabled={tLoading}
              onChange={tTheme}
            />
          </label>
          <HiddenItemsSection />

          {/* eduroam lives here rather than under Student: it configures THIS
              machine, which is a setting, not a page of the study agenda.
              Same hand-off as the welcome modal and the header button — the
              drawer opens on the machine reIS is running on. */}
          <button
            onClick={() => {
              // Same three-answer resolve as the welcome modal: null keeps the
              // drawer's device picker for a desktop reIS has no manual for.
              const target = desktopEduroamTarget();
              if (target) openEduroamFor(target);
              else setIsEduroamOpen(true);
              onClose?.();
            }}
            className="w-full flex items-center justify-between gap-3 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2 flex-1">
              <Wifi size={16} className="text-base-content/50" />
              <span className="text-xs opacity-70">{t('sidebar.eduroam')}</span>
            </span>
            <ChevronRight size={14} className="text-base-content/50" />
          </button>
        </div>

        {/* Admin section: only for a device signed in to the console. Students
            have nothing here — societies are not chosen (spec 2026-10-08). */}
        {(hasAdminSession || isReisAdmin) && (
          <div className="py-1 border-b border-base-200">
            {hasAdminSession && (
              <button
                onClick={openAdmin}
                className="w-full flex items-center gap-2 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors"
              >
                <ShieldCheck size={16} className="text-base-content/50" />
                <span className="text-xs opacity-70">{t('admin.entry')}</span>
              </button>
            )}
            {isReisAdmin && (
              <button
                onClick={() => {
                  openImpersonationPicker();
                  onClose?.();
                }}
                className="w-full flex items-center gap-2 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors"
              >
                <UserCog size={16} className="text-base-content/50" />
                <span className="text-xs opacity-70">{t('impersonation.entry')}</span>
              </button>
            )}
          </div>
        )}

        {/* Support Section */}
        <div className="py-1">
          <button
            onClick={() => {
              onClose?.();
              openReport();
            }}
            className="w-full flex items-center gap-3 px-1 py-1.5 hover:bg-base-200 rounded-lg transition-colors"
          >
            <MessageSquarePlus size={16} className="text-base-content/50" />
            <span className="text-xs font-medium opacity-70">{t('settings.reportBug')}</span>
          </button>

          <div className="flex items-center gap-3 px-1 py-1.5 text-base-content/60">
            <LogOut size={16} className="text-base-content/30" />
            <span className="text-xs font-medium opacity-70">{t('settings.logout')}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                logout();
              }}
              className="font-mono text-xs bg-error/20 text-error px-2.5 py-1 rounded-lg border border-error/30 ml-auto hover:bg-error/30 transition-colors"
            >
              {t('settings.logout')} →
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
