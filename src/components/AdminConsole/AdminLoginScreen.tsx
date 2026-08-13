import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { SocietyLoginForm } from './SocietyLoginForm';

// What a logged-out click on "Spravovat spolky" lands on. Carries its own way
// back: a student who opened it out of curiosity must not be stuck behind a
// credentials prompt with no exit.
export function AdminLoginScreen() {
  const close = useAppStore((s) => s.closeSocietyAdmin);
  const { t } = useTranslation();

  return (
    // `--safe-top` matters here and not only in MobileAdminConsole: this screen
    // is what the native app shows FIRST, and without the inset the back button
    // is drawn underneath the status-bar clock. Resolves to 0px off-mobile.
    <div className="flex h-full min-h-screen w-full flex-col bg-base-200 pt-[var(--safe-top,0px)]">
      <header className="flex h-14 shrink-0 items-center border-b border-base-300 bg-base-100 px-3">
        <button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={close}>
          <ArrowLeft size={16} />
          {t('admin.backToReis') as string}
        </button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
        <div className="w-full max-w-sm rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
          <h1 className="text-lg font-bold">{t('admin.loginTitle') as string}</h1>
          <p className="mb-4 mt-1 text-sm text-base-content/60">
            {t('admin.loginSubtitle') as string}
          </p>
          <SocietyLoginForm />
        </div>
      </div>
    </div>
  );
}
