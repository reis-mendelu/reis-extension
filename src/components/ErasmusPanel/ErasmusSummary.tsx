import { useTranslation } from '@/hooks/useTranslation';
import type { ErasmusReport } from '@/types/erasmus';

interface Props {
  reports: ErasmusReport[];
}

export function ErasmusSummary({ reports }: Props) {
  const { t } = useTranslation();

  const ratings = reports.map(r => parseInt(r.overall.rating)).filter(n => !isNaN(n));
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';

  const costs = reports
    .map(r => {
      const accom = parseFloat(r.finance.accommodationPerDay);
      const food = parseFloat(r.finance.foodPerDay);
      if (isNaN(accom) || isNaN(food)) return null;
      return (accom + food) * 30;
    })
    .filter((c): c is number => c !== null);
  const avgCost = costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : null;

  const grants = reports
    .map(r => parseInt(r.finance.grantCoveragePercent))
    .filter(n => !isNaN(n));
  const avgGrant = grants.length > 0 ? Math.round(grants.reduce((a, b) => a + b, 0) / grants.length) : null;

  return (
    <div className="grid grid-cols-3 gap-3 px-4 pb-3">
      <div className="bg-base-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold">{avgRating}<span className="text-sm text-base-content/50">/5</span></div>
        <div className="text-xs text-base-content/50">{t('erasmus.avgRating')}</div>
      </div>
      <div className="bg-base-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold">{avgCost ?? '—'}<span className="text-sm text-base-content/50">€</span></div>
        <div className="text-xs text-base-content/50">{t('erasmus.avgCost')}</div>
      </div>
      <div className="bg-base-200 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold">{avgGrant ?? '—'}<span className="text-sm text-base-content/50">%</span></div>
        <div className="text-xs text-base-content/50">{t('erasmus.grantCovers')}</div>
      </div>
    </div>
  );
}
