import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { ErasmusReport } from '@/types/erasmus';

interface Props {
  report: ErasmusReport;
}

export function ErasmusReportCard({ report }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rating = parseInt(report.overall.rating);
  const accom = parseFloat(report.finance.accommodationPerDay);
  const food = parseFloat(report.finance.foodPerDay);
  const monthlyCost = !isNaN(accom) && !isNaN(food) ? Math.round((accom + food) * 30) : null;

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <button
        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-base-200 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{report.student.name}</span>
            <span className="badge badge-sm bg-base-200 text-base-content/60">{report.host.name.replace('University of ', '')}</span>
          </div>
          <div className="text-xs text-base-content/50 mt-0.5">
            {report.student.faculty} · {report.stay.from} – {report.stay.to} ({report.stay.durationMonths}{t('erasmus.months')})
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {monthlyCost && (
            <span className="text-xs text-base-content/60">{monthlyCost}€/{t('erasmus.months')}</span>
          )}
          {!isNaN(rating) && (
            <span className={`badge badge-sm ${rating >= 4 ? 'badge-success' : rating >= 3 ? 'badge-warning' : 'badge-error'}`}>
              {rating}/5
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-base-content/40 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-base-300 text-sm space-y-3">
          {/* Finance */}
          <div className="pt-2">
            <h4 className="font-semibold text-xs text-base-content/50 mb-1">{t('erasmus.finance')}</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {report.finance.accommodationPerDay && (
                <div>{t('erasmus.accommodation')}: <strong>{report.finance.accommodationPerDay}€{t('erasmus.perDay')}</strong></div>
              )}
              {report.finance.foodPerDay && (
                <div>{t('erasmus.food')}: <strong>{report.finance.foodPerDay}€{t('erasmus.perDay')}</strong></div>
              )}
              {report.finance.totalCostCZK && (
                <div>{t('erasmus.totalCost')}: <strong>{report.finance.totalCostCZK} Kč</strong></div>
              )}
              {report.finance.grantCoveragePercent && (
                <div>{t('erasmus.grantCoverage')}: <strong>{report.finance.grantCoveragePercent}%</strong></div>
              )}
            </div>
            {report.finance.unaffordable && (
              <p className="text-xs text-error/80 mt-1">{report.finance.unaffordable}</p>
            )}
            {report.finance.savings && (
              <p className="text-xs text-success/80 mt-1">{report.finance.savings}</p>
            )}
          </div>

          {/* Review */}
          {report.overall.review && (
            <div>
              <h4 className="font-semibold text-xs text-base-content/50 mb-1">{t('erasmus.review')}</h4>
              <p className="text-xs text-base-content/70 leading-relaxed">{report.overall.review}</p>
            </div>
          )}

          {/* Tips */}
          {(report.tips.problemsDuring || report.tips.positivesDuring) && (
            <div>
              <h4 className="font-semibold text-xs text-base-content/50 mb-1">{t('erasmus.tips')}</h4>
              {report.tips.problemsDuring && (
                <p className="text-xs text-base-content/70"><span className="text-error/70">{t('erasmus.problems')}:</span> {report.tips.problemsDuring}</p>
              )}
              {report.tips.positivesDuring && (
                <p className="text-xs text-base-content/70 mt-1"><span className="text-success/70">{t('erasmus.positives')}:</span> {report.tips.positivesDuring}</p>
              )}
            </div>
          )}

          {/* Accommodation details */}
          {report.accommodation.foodNotes && (
            <div>
              <h4 className="font-semibold text-xs text-base-content/50 mb-1">{t('erasmus.food')}</h4>
              <p className="text-xs text-base-content/70">{report.accommodation.foodNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
