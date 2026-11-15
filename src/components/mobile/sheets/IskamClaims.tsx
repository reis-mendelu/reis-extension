import { BedDouble } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';
import { formatKc } from './formatKc';

function formatDue(iso: string, language: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'cz' ? 'cs-CZ' : 'en-GB', {
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(y!, m! - 1, d!));
}

/**
 * Open WebISKAM claims (the dorm's monthly payment), under the ISIC balance.
 *
 * Zaplatit opens WebISKAM's own page with its "Uhradit" dialog up; the student
 * pays there with WebISKAM's button, and reIS sends nothing itself. It pays
 * from the Hlavní konto, so it is enabled only when the balance covers the
 * claim; otherwise the row says how much to top up, with Dobít right above.
 * Shown only beside a balance WebISKAM has just confirmed.
 */
export function IskamClaims() {
  const { t, language } = useTranslation();
  const claims = useIskamStore((s) => s.claims);
  const balance = useIskamStore((s) => s.balance);
  const paying = useIskamStore((s) => s.payingClaim);
  const paid = useIskamStore((s) => s.lastClaimPaid);
  if (balance === null) return null;
  // WebISKAM shows nothing after paying, so reIS says it — once the re-read
  // shows the claim gone. Also beside claims that are still open.
  const paidNotice = paid ? (
    <p role="status" className="mt-2 text-2sm font-bold text-[var(--tone-success)]">
      {t('iskam.claimPaid', { amount: formatKc(paid.amount, language, { whole: true }) })}
    </p>
  ) : null;
  if (!claims?.length) return paidNotice;

  return (
    <>
      {paidNotice}
      <ul data-testid="iskam-claims" className="mt-2.5 border-t border-base-content/10 pt-2.5">
        {claims.map((c) => {
          const covered = balance.amount >= c.remaining;
          return (
            <li key={c.id} className="py-0.5">
              <div className="flex items-center gap-2.5">
                <BedDouble size={18} className="flex-shrink-0 text-base-content/60" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-2sm text-base-content/70">{c.description}</span>
                  {/* Three short lines, not two long ones: at 320px a joined
                    "amount · due" line cut the due date off. */}
                  <span className="truncate text-md font-bold text-base-content">
                    {formatKc(c.remaining, language, { whole: true })}
                  </span>
                  <span className="truncate text-2sm text-base-content/70">
                    {t('iskam.claimDue', { date: formatDue(c.due, language) })}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm flex-shrink-0 disabled:opacity-40"
                  disabled={!covered || paying}
                  onClick={() => void useIskamStore.getState().payClaim(c.id)}
                >
                  {t('iskam.payClaim')}
                </button>
              </div>
              {!covered && (
                <p className="mt-1.5 text-2sm text-base-content/70">
                  {t('iskam.claimShort', {
                    amount: formatKc(Math.ceil(c.remaining - balance.amount), language),
                  })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
