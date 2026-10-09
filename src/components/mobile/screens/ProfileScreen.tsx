import { useState } from 'react';
import {
  Wifi,
  FileText,
  MessageSquarePlus,
  LogOut,
  UserCog,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { SignOutConfirm } from '../sheets/SignOutConfirm';
import { AboutSection } from './profile/AboutSection';
import { ProfileIdentity } from './profile/ProfileIdentity';
import { NavRow } from '../primitives/NavRow';
import { ScreenHeader } from './calendar/ScreenHeader';
import { AlwaysScrollable } from '../primitives/AlwaysScrollable';

/**
 * The profile TAB: a way into Nastavení, eduroam setup, documents, feedback and
 * logout. Reuses the shared report form (mounted by `MobileApp`) rather than
 * rebuilding it. No societies section: there is nothing to choose (spec
 * 2026-10-08); the console is reached by holding the name.
 *
 * No hidden-items list: hiding exists only on desktop calendar cards and
 * storage is per device, so on a phone it was always empty (spec 2026-10-09).
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
          {/* One row, not a group: calendar view, language and dark mode are set
            once (spec 2026-10-09), so they sit one tap down and the screen
            keeps its room for things a student comes here to do. The second
            line names what is inside, like every row here — the bare values
            ("Den · Čeština · Tmavý") read as noise out of context. */}
          <div className="pt-2">
            <NavRow
              icon={Settings}
              label={t('mobile.profile.settings')}
              sublabel={t('mobile.profile.settingsSub')}
              onClick={() => pushSheet({ kind: 'settings' })}
            />
          </div>

          <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.profile.atSchool')}
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
