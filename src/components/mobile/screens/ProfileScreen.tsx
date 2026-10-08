import { useState } from 'react';
import { Wifi, FileText, MessageSquarePlus, LogOut, UserCog, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { HiddenItemsSection } from '../../Sidebar/Profile/HiddenItemsSection';
import { SignOutConfirm } from '../sheets/SignOutConfirm';
import { AboutSection } from './profile/AboutSection';
import { ProfileIdentity } from './profile/ProfileIdentity';
import { NavRow } from '../primitives/NavRow';
import { AppearanceRows } from './profile/AppearanceRows';
import { ScreenHeader } from './calendar/ScreenHeader';
import { AlwaysScrollable } from '../primitives/AlwaysScrollable';

/**
 * The profile TAB: theme, language, eduroam setup, hidden items, feedback and
 * logout. Reuses desktop's `HiddenItemsSection` and the shared report form
 * (mounted by `MobileApp`) wholesale rather than rebuilding them — only the row
 * layout around them is phone-specific. No societies section: there is nothing
 * to choose (spec 2026-10-08); the console is reached by holding the name.
 *
 * `HiddenItemsSection` is the same component the desktop sidebar profile
 * uses, so a hidden event shows up here already — restoring it calls the same
 * `unhideEvent` action that removes it from the store's `hiddenItems`.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const openReport = useAppStore((s) => s.openReport);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const isReisAdmin = useAppStore((s) => s.adminRole === 'reis_admin');
  // Signed in to the console on this device (held the name once): keep a way back.
  const hasAdminSession = useAppStore((s) => s.adminSession !== null);
  const openSocietyAdmin = useAppStore((s) => s.openSocietyAdmin);
  const loadImpersonationOptions = useAppStore((s) => s.loadImpersonationOptions);

  return (
    <div data-testid="profile-screen" className="flex flex-1 flex-col overflow-hidden">
      {/* No eyebrow: the header's title block shares its row with the three
          action buttons, so at 320px it has ~152px — a programme name needs
          206px and was truncated there. The identity gets its own full-width
          block below instead, which is where it lived as a sheet. */}
      <ScreenHeader title={t('sidebar.profile')} />
      <ProfileIdentity />

      {/* pb-[84px], not pb-24. The floating BottomNav needs 76px of clearance —
          measured, `innerHeight - nav.top` at 375×780 — and 96 reserved 20px of
          nothing at the bottom of a screen that must not scroll. 8px of margin
          over the measurement, so a taller nav does not silently tuck under. */}
      <div data-testid="profile-scroll" className="flex-1 overflow-y-auto">
        <AlwaysScrollable className="pb-[calc(84px_+_var(--safe-bottom,0px))]">
          <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.profile.appearance')}
          </div>
          <AppearanceRows />

          <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.profile.settings')}
          </div>
          {/* eduroam lives here rather than on the Student hub: it is a one-time
            device setup, which is what a settings screen is for, and it was
            competing for attention with everyday shortcuts. One tap, same
            sheet — SheetHost stacks it above this one. */}
          <NavRow
            icon={Wifi}
            label={t('mobile.student.eduroam')}
            sublabel={t('mobile.student.eduroamSub')}
            onClick={() => pushSheet({ kind: 'eduroam' })}
          />
          {/* Dokumenty was the last card on the Student hub. The hub's IS page
            directory is gone from the phone tree (every link opened the system
            browser, which has no IS session), so the card follows eduroam here
            rather than keeping a whole segment alive for one button. */}
          <NavRow
            icon={FileText}
            label={t('mobile.student.documents')}
            sublabel={t('mobile.student.documentsSub')}
            onClick={() => pushSheet({ kind: 'docs' })}
          />

          {hasAdminSession && (
            <NavRow icon={ShieldCheck} label={t('admin.entry')} onClick={openSocietyAdmin} />
          )}

          {/* reIS admins only. Options load from the tap, never from an effect. */}
          {isReisAdmin && (
            <NavRow
              icon={UserCog}
              label={t('impersonation.entry')}
              sublabel={t('impersonation.entrySub')}
              onClick={() => {
                void loadImpersonationOptions();
                pushSheet({ kind: 'impersonation' });
              }}
            />
          )}

          <HiddenItemsSection />

          <div className="mx-4 my-2 h-px bg-base-content/10" />

          <NavRow
            icon={MessageSquarePlus}
            label={t('settings.reportBug')}
            onClick={() => openReport()}
          />

          <button
            type="button"
            onClick={() => setSignOutOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3 text-[var(--tone-error)]"
          >
            <LogOut size={17} className="flex-shrink-0" />
            <span className="flex-1 text-left text-md font-medium">{t('settings.logout')}</span>
          </button>

          {/* Open, not behind a row: a credit that has to be opened is a credit
            nobody reads, and a student writing a bug report should find the
            version without hunting for it. */}
          <AboutSection />
        </AlwaysScrollable>
      </div>

      <SignOutConfirm open={signOutOpen} onCancel={() => setSignOutOpen(false)} />
    </div>
  );
}
