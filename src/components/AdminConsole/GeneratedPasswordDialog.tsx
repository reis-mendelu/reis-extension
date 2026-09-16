import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Shows a generated password exactly once. The value lives only in the parent's
 * state for the life of this dialog — never persisted, never logged, never sent
 * anywhere. Closing drops it for good, which is why the copy button matters.
 *
 * `login` is the other half of the credential. A password alone is not something
 * you can hand over: the account it belongs to is the association_id, and this
 * dialog is the ONLY moment the pair exists together, since the password is
 * gone once it closes.
 */
export function GeneratedPasswordDialog({
  password,
  login,
  onClose,
}: {
  password: string;
  login?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{t('admin.resetPassword')}</h3>
        <p className="py-2 text-sm opacity-70">{t('admin.passwordShownOnce')}</p>
        {login && (
          <p className="text-sm">
            <span className="opacity-70">{t('admin.loginName')}: </span>
            <span className="font-mono font-bold">{login}</span>
          </p>
        )}
        <p className="font-mono text-lg break-all bg-base-200 rounded-box p-3 mt-2">{password}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={copy}>
            {copied ? t('admin.copied') : t('admin.copy')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('admin.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
