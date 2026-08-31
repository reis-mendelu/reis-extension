import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  createSocietyAccount,
  listSocietyAccounts,
  resetSocietyPassword,
  type SocietyAccountRow,
} from '../../api/societyAccounts';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';

/**
 * reIS-admin-only. Resetting runs in the society-accounts edge function, which
 * re-checks the caller's role server-side — this component gating on adminRole
 * is a UI convenience, never the authorization.
 */
export function SocietyAccountsPanel() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<SocietyAccountRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    void listSocietyAccounts().then(setAccounts);
  }, []);

  const reset = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setFailed(false);
    const res = await resetSocietyPassword(selected);
    if (res.password) setPassword(res.password);
    else setFailed(true);
    setBusy(false);
  };

  const create = async () => {
    if (busy || !newName.trim() || !newLabel.trim()) return;
    setBusy(true);
    setFailed(false);
    const res = await createSocietyAccount(newName.trim(), newLabel.trim());
    if (res.password) {
      setPassword(res.password);
      setNewName('');
      setNewLabel('');
      setAccounts(await listSocietyAccounts());
    } else {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {accounts.map((a) => (
        <button
          key={a.association_id}
          type="button"
          className={`btn btn-block justify-start ${
            selected === a.association_id ? 'btn-primary' : ''
          }`}
          onClick={() => setSelected(a.association_id)}
        >
          {a.association_name}
        </button>
      ))}

      <button
        type="button"
        className="btn btn-primary"
        disabled={!selected || busy}
        onClick={reset}
      >
        {t('admin.resetPassword')}
      </button>

      {failed && (
        <p role="alert" className="text-error text-sm">
          {t('admin.resetFailed')}
        </p>
      )}

      <div className="divider" />

      <h3 className="font-bold">{t('admin.createAccount')}</h3>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.username')}</span>
        <input
          aria-label={t('admin.username')}
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="input input-bordered"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{t('admin.displayName')}</span>
        <input
          aria-label={t('admin.displayName')}
          type="text"
          className="input input-bordered"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !newName.trim() || !newLabel.trim()}
        onClick={create}
      >
        {t('admin.createAccount')}
      </button>

      {password && (
        <GeneratedPasswordDialog password={password} onClose={() => setPassword(null)} />
      )}
    </div>
  );
}
