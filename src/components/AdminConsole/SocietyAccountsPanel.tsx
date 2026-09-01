import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createSocietyAccount, resetSocietyPassword } from '../../api/societyAccounts';
import { GeneratedPasswordDialog } from './GeneratedPasswordDialog';
import { ALL_SOCIETIES } from '../../data/societies';

/**
 * reIS-admin-only. Resetting runs in the society-accounts edge function, which
 * re-checks the caller's role server-side — this component gating on adminRole
 * is a UI convenience, never the authorization.
 */
export function SocietyAccountsPanel() {
  const { t } = useTranslation();
  // Your own account never appears in the reset list. Resetting yourself here
  // would issue a password you must copy from a dialog or lose access to the
  // account you are signed in as — and "Změnit heslo" below already covers it,
  // where you choose the value. Keyed on the signed-in account rather than on
  // the reis_admin role, so a second admin can still reset the first.
  const ownAssociationId = useAppStore((s) => s.adminAssociationId);
  // Loaded by the admin slice when the reis_admin session is established and
  // refreshed after a create; the panel only reads it.
  const accounts = useAppStore((s) => s.societyAccounts);
  const loadSocietyAccounts = useAppStore((s) => s.loadSocietyAccounts);
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  const resettable = accounts.filter((a) => a.association_id !== ownAssociationId);

  const reset = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setFailed(false);
    const res = await resetSocietyPassword(selected);
    if (res.password) setPassword(res.password);
    else setFailed(true);
    setBusy(false);
  };

  // Only ids present in the static catalog may be created. An id outside it has
  // no colour, logo or facultyKey, and societyById() falls back to ESN — so a
  // typo would render the new society AS ESN on the map. Constraining the field
  // makes that unreachable rather than merely logged.
  const taken = new Set(accounts.map((a) => a.association_id));
  const available = ALL_SOCIETIES.filter((s) => !taken.has(s.id));

  const create = async () => {
    const chosen = ALL_SOCIETIES.find((s) => s.id === newName);
    if (busy || !chosen) return;
    setBusy(true);
    setFailed(false);
    const res = await createSocietyAccount(chosen.id, chosen.name);
    if (res.password) {
      setPassword(res.password);
      setNewName('');
      await loadSocietyAccounts();
    } else {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {resettable.map((a) => (
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
        <select
          aria-label={t('admin.username')}
          className="select select-bordered"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        >
          <option value="">{t('admin.pickSociety')}</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.id})
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !newName}
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
