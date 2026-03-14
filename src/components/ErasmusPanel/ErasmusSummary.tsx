import { useTranslation } from '@/hooks/useTranslation';
import type { ErasmusReport } from '@/types/erasmus';

interface Props {
  reports: ErasmusReport[];
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

export function ErasmusSummary({ reports }: Props) {
  const { t } = useTranslation();

  const ratings = reports.map(r => parseInt(r.overall.rating)).filter(n => !isNaN(n));
  const medianRating = ratings.length > 0 ? median(ratings).toFixed(1) : '—';

  const costs = reports
    .map(r => {
      const accom = parseFloat(r.finance.accommodationPerDay);
      const food = parseFloat(r.finance.foodPerDay);
      if (isNaN(accom) || isNaN(food)) return null;
      return (accom + food) * 30;
    })
    .filter((c): c is number => c !== null);

  const medianCost = costs.length > 0 ? Math.round(median(costs)) : null;
  const costRange = costs.length >= 4
    ? `${Math.round(percentile(costs, 25))}–${Math.round(percentile(costs, 75))}`
    : null;

  const grants = reports
    .map(r => parseInt(r.finance.grantCoveragePercent))
    .filter(n => !isNaN(n));
  const medianGrant = grants.length > 0 ? Math.round(median(grants)) : null;

  return (
    <div className="grid grid-cols-3 gap-3 px-4 pb-3">
      <div className="bg-base-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold">{medianRating}<span className="text-sm text-base-content/50">/5</span></div>
        <div className="text-xs text-base-content/50">{t('erasmus.medianRating')}</div>
      </div>
      <div className="bg-base-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold">{medianCost ?? '—'}<span className="text-sm text-base-content/50">€</span></div>
        <div className="text-xs text-base-content/50">{t('erasmus.medianCost')}</div>
        {costRange && (
          <div className="text-[10px] text-base-content/40 mt-0.5">{costRange}€</div>
        )}
      </div>
      <div className="bg-base-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold">{medianGrant ?? '—'}<span className="text-sm text-base-content/50">%</span></div>
        <div className="text-xs text-base-content/50">{t('erasmus.grantCovers')}</div>
      </div>
    </div>
  );
}
