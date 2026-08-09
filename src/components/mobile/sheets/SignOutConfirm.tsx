import { useState } from 'react';
import { toast } from 'sonner';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { logout } from '../../../api/proxyClient';

export interface SignOutConfirmProps {
  open: boolean;
  onCancel: () => void;
}

/**
 * Confirms signing out, because on a phone it is destructive: the stored IS
 * login and every downloaded file go with it, and the row sits one thumb-width
 * below "Report a bug" in a scrolling list.
 *
 * Its own component rather than a branch inside `ProfileSheet` — that sheet is
 * already at the file-length limit, and the confirm owns a piece of state and
 * an async call that have nothing to do with the settings rows.
 *
 * Not routed through `SheetHost`: this belongs to the settings sheet that
 * opened it and must stack directly above it, the same way `ConfirmSheet`
 * mounts inside `ExamsScreen`.
 */
export function SignOutConfirm({ open, onCancel }: SignOutConfirmProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await logout();
      // No success toast: a successful sign-out reloads the app straight into
      // the login, so there is nothing left to show it on.
    } catch {
      toast.error(t('settings.logoutFailed'));
      setBusy(false);
      onCancel();
    }
  };

  return (
    // Every dismissal path is inert once the sign-out is under way. It cannot
    // be called off — logout() clears the token and reloads — so letting the
    // sheet close would read as a cancelled sign-out right before the app
    // restarts underneath the student.
    <Sheet size="content" onClose={busy ? () => {} : onCancel} elevated>
      <SheetHeader title={t('settings.logoutConfirmTitle')} onClose={busy ? () => {} : onCancel} />
      <div className="flex flex-col gap-3 px-4 pb-5">
        <p className="text-sm text-base-content/70">{t('settings.logoutConfirmBody')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl border border-base-300 text-base font-semibold text-base-content/70 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl bg-error text-base font-semibold text-error-content disabled:opacity-50"
          >
            {busy ? <span className="loading loading-spinner loading-xs" /> : t('settings.logout')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
