import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// No <form> native submission: the reIS app runs in a sandboxed iframe without
// `allow-forms`, so a real form submit is blocked. Trigger from onClick and
// support Enter via onKeyDown, exactly as SocietyLoginForm does.
export function ChangeMyPasswordForm() {
  const changeMyPassword = useAppStore((s) => s.changeMyPassword);
  const { t } = useTranslation();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error' | 'short'>('idle');
  const [busy, setBusy] = useState(false);

  const ready = next.length >= 12 && next === confirm;

  const submit = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setStatus('idle');
    const res = await changeMyPassword(next);
    if (!res.error) {
      setStatus('done');
      setNext('');
      setConfirm('');
    } else {
      setStatus(res.error === 'too_short' ? 'short' : 'error');
    }
    setBusy(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void submit();
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold">{t('admin.changeMyPassword')}</h3>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.newPassword')}</span>
        <input
          aria-label={t('admin.newPassword')}
          type="password"
          autoComplete="new-password"
          className="input input-bordered"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          onKeyDown={onKey}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.confirmPassword')}</span>
        <input
          aria-label={t('admin.confirmPassword')}
          type="password"
          autoComplete="new-password"
          className="input input-bordered"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={onKey}
        />
      </label>

      {status === 'short' && (
        <p role="alert" className="text-error text-sm">
          {t('admin.passwordTooShort')}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-error text-sm">
          {t('admin.passwordChangeFailed')}
        </p>
      )}
      {status === 'done' && (
        <p role="alert" className="text-success text-sm">
          {t('admin.passwordChanged')}
        </p>
      )}

      <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={submit}>
        {t('admin.changeMyPassword')}
      </button>
    </div>
  );
}
