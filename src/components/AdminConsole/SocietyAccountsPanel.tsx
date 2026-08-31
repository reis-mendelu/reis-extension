import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import {
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

      {password && (
        <GeneratedPasswordDialog password={password} onClose={() => setPassword(null)} />
      )}
    </div>
  );
}
