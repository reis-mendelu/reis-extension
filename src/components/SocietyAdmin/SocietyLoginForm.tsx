import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function SocietyLoginForm() {
  const adminLogin = useAppStore((s) => s.adminLogin);
  const { t } = useTranslation();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(false);
    const res = await adminLogin(handle, password);
    setBusy(false);
    if (res.error) setError(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.handle')}</span>
        <input aria-label={t('admin.handle')} className="input input-bordered" value={handle}
               onChange={(e) => setHandle(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.password')}</span>
        <input aria-label={t('admin.password')} type="password" className="input input-bordered"
               value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="text-error text-sm">{t('admin.loginError')}</p>}
      <button className="btn btn-primary" disabled={busy || !handle || !password}>{t('admin.login')}</button>
    </form>
  );
}
