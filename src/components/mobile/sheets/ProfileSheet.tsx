import { useState } from 'react';
import {
  X,
  Moon,
  Languages,
  Calendar,
  Wifi,
  MessageSquarePlus,
  LogOut,
  ChevronRight,
  User,
} from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { useAppStore } from '../../../store/useAppStore';
import { useTheme } from '../../../hooks/useTheme';
import { useOutlookSync } from '../../../hooks/data/useOutlookSync';
import { useSpolkySettings } from '../../../hooks/useSpolkySettings';
import { useStudyPlan } from '../../../hooks/useStudyPlan';
import { useTranslation } from '../../../hooks/useTranslation';
import { SpolkySection } from '../../Sidebar/Profile/SpolkySection';
import { HiddenItemsSection } from '../../Sidebar/Profile/HiddenItemsSection';
import { FeedbackModal } from '../../Feedback/FeedbackModal';
import { SignOutConfirm } from './SignOutConfirm';
import { PersonPhoto } from '../../ui/PersonPhoto';

export interface ProfileSheetProps {
  onClose: () => void;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Full-size settings sheet: theme, language, Outlook sync, eduroam setup,
 * hidden items, society map filters, feedback and logout. Reuses desktop's
 * `SpolkySection` / `HiddenItemsSection` / `FeedbackModal` wholesale rather
 * than rebuilding them — only the row layout around them is phone-specific.
 *
 * `HiddenItemsSection` is the same component the desktop sidebar profile
 * uses, so an event `EventDetailSheet` hides shows up here already —
 * restoring it calls the same `unhideEvent` action that removes it from the
 * store's `hiddenItems`.
 */
export function ProfileSheet({ onClose }: ProfileSheetProps) {
  const { t } = useTranslation();
  const fullName = useAppStore((s) => s.fullName);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { isDark, toggle: toggleTheme } = useTheme();
  const {
    isEnabled: outlookEnabled,
    isLoading: outlookLoading,
    toggle: toggleOutlook,
  } = useOutlookSync();
  const { isSubscribed, toggleAssociation } = useSpolkySettings();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const plan = useStudyPlan();
  const [spolkyOpen, setSpolkyOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const studentId = useAppStore((s) => s.studentId);

  const name = fullName ?? '';

  return (
    <Sheet size="full" onClose={onClose}>
      <div className="flex-shrink-0">
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-base-300" />
        <div className="flex items-center gap-3 px-4 pb-3 pt-2">
          {/* The student's own face, the one photo the app never showed: this
              sheet rendered initials, and a generic glyph whenever `fullName`
              had not resolved. `studentId` is IS's "Identifikační číslo
              uživatele", the same id space `foto.pl` takes for everyone else,
              so the existing authenticated fetch covers this with no new
              endpoint. Initials stay as the fallback while it loads or when
              there is no picture. */}
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-200 font-display text-base font-bold text-primary">
            <PersonPhoto
              personId={studentId}
              alt={name}
              className="h-full w-full object-cover"
              fallback={name ? initials(name) : <User size={18} />}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-display text-lg font-bold tracking-tight">{name}</span>
            {plan?.title && (
              <span className="truncate text-sm text-base-content/60">{plan.title}</span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t('mobile.sheet.close')}
            className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.profile.appearance')}
        </div>
        {/* No caption under the label. A dark-mode switch does not need one,
            and "šetří oči i baterku" was a second line of type for a control
            whose entire meaning is its own name. */}
        <label className="flex items-center gap-3 px-4 py-2.5">
          <Moon size={16} className="flex-shrink-0 text-base-content/50" />
          <span className="min-w-0 flex-1 text-md font-medium">{t('settings.darkMode')}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={isDark}
            onChange={toggleTheme}
          />
        </label>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Languages size={16} className="flex-shrink-0 text-base-content/50" />
          <span className="flex-1 text-md font-medium">{t('settings.language')}</span>
          <div className="join">
            <button
              type="button"
              onClick={() => setLanguage('cz')}
              className={`join-item btn btn-xs ${language === 'cz' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
            >
              {t('settings.czech')}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`join-item btn btn-xs ${language === 'en' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
            >
              {t('settings.english')}
            </button>
          </div>
        </div>

        <div className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.profile.sync')}
        </div>
        <label className="flex items-center gap-3 px-4 py-2.5">
          <Calendar size={16} className="flex-shrink-0 text-base-content/50" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-md font-medium">{t('sync.schedule')}</span>
            <span className="truncate text-xs text-base-content/60">{t('sync.tooltip')}</span>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={outlookEnabled ?? false}
            disabled={outlookLoading}
            onChange={toggleOutlook}
          />
        </label>
        {/* Google Drive backup is deliberately absent on mobile. It is
            non-functional there on every axis (issue #168), so the toggle only
            ever promised something the app could not deliver. The desktop
            sidebar keeps it. */}

        {/* eduroam lives here rather than on the Student hub: it is a one-time
            device setup, which is what a settings screen is for, and it was
            competing for attention with everyday shortcuts. One tap, same
            sheet — SheetHost stacks it above this one. */}
        <button
          type="button"
          onClick={() => pushSheet({ kind: 'eduroam' })}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
        >
          <Wifi size={16} className="flex-shrink-0 text-base-content/50" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-md font-medium">{t('mobile.student.eduroam')}</span>
            <span className="truncate text-xs text-base-content/60">
              {t('mobile.student.eduroamSub')}
            </span>
          </div>
          <ChevronRight size={16} className="flex-shrink-0 text-base-content/40" />
        </button>

        <HiddenItemsSection />

        <div className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.profile.societies')}
        </div>
        <div className="px-3">
          <SpolkySection
            expanded={spolkyOpen}
            onToggle={() => setSpolkyOpen((v) => !v)}
            isSub={isSubscribed}
            onToggleAssoc={toggleAssociation}
            onNavigate={onClose}
          />
        </div>

        <div className="mx-4 my-3 h-px bg-base-300" />

        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3"
        >
          <MessageSquarePlus size={17} className="flex-shrink-0 text-base-content/50" />
          <span className="flex-1 text-left text-md font-medium">{t('settings.reportBug')}</span>
          <ChevronRight size={15} className="text-base-content/40" />
        </button>
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-error"
        >
          <LogOut size={17} className="flex-shrink-0" />
          <span className="flex-1 text-left text-md font-medium">{t('settings.logout')}</span>
        </button>
      </div>

      <SignOutConfirm open={signOutOpen} onCancel={() => setSignOutOpen(false)} />
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Sheet>
  );
}
