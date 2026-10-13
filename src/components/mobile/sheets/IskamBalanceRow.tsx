import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';

/** In the APP's language — WebISKAM's own text follows the phone's instead. */
function formatKc(amount: number, language: string): string {
  return new Intl.NumberFormat(language === 'cz' ? 'cs-CZ' : 'en-GB', {
    style: 'currency',
    currency: 'CZK',
  }).format(amount);
}

/**
 * The ISIC Hlavní konto balance, at the top of the jídelníček sheet.
 *
 * Four states (see the spec's UI table). The balance is shown only after
 * WebISKAM has just confirmed it; otherwise the row says why not. Dobít is
 * enabled only beside a confirmed balance. Phone/iPad only — see
 * src/test/guards/desktopHasNoIskam.test.ts.
 */
export function IskamBalanceRow() {
  const { t, language } = useTranslation();
  const status = useIskamStore((s) => s.status);
  const balance = useIskamStore((s) => s.balance);
  const signingIn = useIskamStore((s) => s.signingIn);
  const [open, setOpen] = useState(false);
  if (status === 'hidden') return null;
  const canTopUp = status === 'balance' && balance !== null;

  return (
    <div
      data-testid="iskam-row"
      className="mx-4 mb-3 rounded-2xl border border-base-content/10 bg-base-100 px-3.5 py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <CreditCard size={18} className="flex-shrink-0 text-base-content/60" aria-hidden />
        {status === 'signed-out' ? (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-md font-bold text-primary"
            disabled={signingIn}
            onClick={() => void useIskamStore.getState().signIn()}
          >
            {t('iskam.show')}
          </button>
        ) : status === 'unavailable' ? (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-md text-base-content/70"
            onClick={() => void useIskamStore.getState().check()}
          >
            {t('iskam.unavailable')}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-md font-bold text-base-content">
            {t('iskam.label')}
          </span>
        )}
        {status === 'checking' && (
          <span
            data-testid="iskam-skeleton"
            className="skeleton h-4 w-16"
            aria-label={t('iskam.checking')}
          />
        )}
        {canTopUp && (
          <span
            data-testid="iskam-amount"
            className="whitespace-nowrap text-md font-bold text-base-content"
          >
            {formatKc(balance.amount, language)}
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm flex-shrink-0"
          disabled={!canTopUp}
          aria-expanded={open && canTopUp}
          onClick={() => setOpen((o) => !o)}
        >
          {t('iskam.topUp')}
        </button>
      </div>
    </div>
  );
}
