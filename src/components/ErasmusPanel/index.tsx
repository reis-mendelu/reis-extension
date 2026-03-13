import { useMemo, useState } from 'react';
import { useErasmus } from '@/hooks/data/useErasmus';
import { useTranslation } from '@/hooks/useTranslation';
import { ErasmusSummary } from './ErasmusSummary';
import { ErasmusReportCard } from './ErasmusReportCard';
import type { ErasmusReport } from '@/types/erasmus';

type SortKey = 'newest' | 'oldest' | 'rating' | 'cheapest';

function parseDate(d: string): number {
  // "21. 2. 2022" → Date
  const parts = d.replace(/\s/g, '').split('.');
  if (parts.length < 3) return 0;
  return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
}

function sortReports(reports: ErasmusReport[], key: SortKey): ErasmusReport[] {
  return [...reports].sort((a, b) => {
    switch (key) {
      case 'newest': return parseDate(b.stay.from) - parseDate(a.stay.from);
      case 'oldest': return parseDate(a.stay.from) - parseDate(b.stay.from);
      case 'rating': return parseInt(b.overall.rating) - parseInt(a.overall.rating);
      case 'cheapest': {
        const costA = (parseFloat(a.finance.accommodationPerDay) || 99) + (parseFloat(a.finance.foodPerDay) || 99);
        const costB = (parseFloat(b.finance.accommodationPerDay) || 99) + (parseFloat(b.finance.foodPerDay) || 99);
        return costA - costB;
      }
    }
  });
}

export function ErasmusPanel() {
  const { t } = useTranslation();
  const { reports, loading } = useErasmus();
  const [institution, setInstitution] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  const institutions = useMemo(() => {
    const set = new Set(reports.map(r => r.host.name));
    return Array.from(set).sort();
  }, [reports]);

  const filtered = useMemo(() => {
    let result = reports;
    if (institution) result = result.filter(r => r.host.name === institution);
    if (minRating > 0) result = result.filter(r => parseInt(r.overall.rating) >= minRating);
    return sortReports(result, sortBy);
  }, [reports, institution, minRating, sortBy]);

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/50">
        {t('erasmus.noData')}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold">{t('erasmus.title')}</h2>
        <p className="text-xs text-base-content/50 mb-3">
          {t('erasmus.subtitle')} · {filtered.length}/{reports.length} {t('erasmus.reports')}
        </p>
      </div>

      <ErasmusSummary reports={filtered} />

      {/* Filters */}
      <div className="px-4 pb-3 flex gap-2 flex-wrap">
        <select
          className="select select-sm select-bordered flex-1 min-w-[120px]"
          value={institution}
          onChange={e => setInstitution(e.target.value)}
        >
          <option value="">{t('erasmus.allInstitutions')}</option>
          {institutions.map(inst => (
            <option key={inst} value={inst}>{inst.replace('University of ', '')}</option>
          ))}
        </select>
        <select
          className="select select-sm select-bordered w-20"
          value={minRating}
          onChange={e => setMinRating(parseInt(e.target.value))}
        >
          <option value="0">{t('erasmus.rating')}</option>
          {[4, 3, 2, 1].map(r => (
            <option key={r} value={r}>{r}+</option>
          ))}
        </select>
        <select
          className="select select-sm select-bordered w-28"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
        >
          <option value="newest">{t('erasmus.sortNewest')}</option>
          <option value="oldest">{t('erasmus.sortOldest')}</option>
          <option value="rating">{t('erasmus.sortRating')}</option>
          <option value="cheapest">{t('erasmus.sortCheapest')}</option>
        </select>
      </div>

      {/* Report list */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {filtered.map((report: ErasmusReport) => (
          <ErasmusReportCard key={report.reportId} report={report} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-base-content/50 py-8">
            {t('erasmus.noData')}
          </div>
        )}
      </div>
    </div>
  );
}
