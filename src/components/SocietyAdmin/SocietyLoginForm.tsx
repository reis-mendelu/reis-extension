import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// No <form> native submission: the reIS app runs in a sandboxed iframe without
// `allow-forms`, so a real form submit is blocked. We trigger login from the
// button's onClick and support Enter via onKeyDown instead. Societies sign in
// with the real email on their account (e.g. admin@supef.cz).
export function SocietyLoginForm() {
  const adminLogin = useAppStore((s) => s.adminLogin);
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true); setError(false);
    try {
      const res = await adminLogin(email, password);
      if (res.error) setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.email')}</span>
        <input aria-label={t('admin.email')} type="email" autoComplete="username" className="input input-bordered" value={email}
               onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.password')}</span>
        <input aria-label={t('admin.password')} type="password" autoComplete="current-password" className="input input-bordered"
               value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} />
      </label>
      {error && <p className="text-error text-sm">{t('admin.loginError')}</p>}
      <button type="button" className="btn btn-primary" disabled={busy || !email.trim() || !password} onClick={submit}>{t('admin.login')}</button>
    </div>
  );
}
