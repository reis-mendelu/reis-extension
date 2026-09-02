import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Shows a generated password exactly once. The value lives only in the parent's
 * state for the life of this dialog — never persisted, never logged, never sent
 * anywhere. Closing drops it for good, which is why the copy button matters.
 */
export function GeneratedPasswordDialog({
  password,
  onClose,
}: {
  password: string;
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
        <p className="font-mono text-lg break-all bg-base-200 rounded-box p-3">{password}</p>
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
