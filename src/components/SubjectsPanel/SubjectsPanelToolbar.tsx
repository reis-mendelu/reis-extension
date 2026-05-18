import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpWideNarrow, Coins, ListOrdered } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { SortMode, SubjectFilters } from './types';

interface Props {
  sortMode: SortMode;
  filters: SubjectFilters;
  onSortChange: (m: SortMode) => void;
  onFiltersChange: (f: SubjectFilters) => void;
}

const sortIcon: Record<SortMode, typeof ListOrdered> = {
  default: ListOrdered,
  failRateDesc: ArrowDownWideNarrow,
  failRateAsc: ArrowUpWideNarrow,
  creditsDesc: Coins,
  alpha: ArrowDownAZ,
};

export function SubjectsPanelToolbar({ sortMode, filters, onSortChange, onFiltersChange }: Props) {
  const { t } = useTranslation();
  const SortIcon = sortIcon[sortMode];
  const sortOptions: SortMode[] = ['default', 'failRateDesc', 'failRateAsc', 'creditsDesc', 'alpha'];

  const toggleSemesterType = (next: 'ZS' | 'LS') => {
    onFiltersChange({ ...filters, semesterType: filters.semesterType === next ? 'all' : next });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
      <div className="dropdown dropdown-end">
        <div tabIndex={0} role="button" className="btn btn-sm btn-ghost gap-1.5 text-base-content/70">
          <SortIcon className="w-3.5 h-3.5" />
          <span className="text-xs">{t(`subjects.sort.${sortMode}`)}</span>
        </div>
        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-1 shadow-lg border border-base-300">
          {sortOptions.map(opt => {
            const Icon = sortIcon[opt];
            return (
              <li key={opt}>
                <button
                  onClick={() => { onSortChange(opt); (document.activeElement as HTMLElement | null)?.blur(); }}
                  className={sortMode === opt ? 'active' : ''}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{t(`subjects.sort.${opt}`)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="join">
        <button
          onClick={() => toggleSemesterType('ZS')}
          className={`btn btn-xs join-item ${filters.semesterType === 'ZS' ? 'btn-primary' : 'btn-ghost'}`}
        >
          {t('subjects.filter.zs')}
        </button>
        <button
          onClick={() => toggleSemesterType('LS')}
          className={`btn btn-xs join-item ${filters.semesterType === 'LS' ? 'btn-primary' : 'btn-ghost'}`}
        >
          {t('subjects.filter.ls')}
        </button>
      </div>

      <button
        onClick={() => onFiltersChange({ ...filters, hideFulfilled: !filters.hideFulfilled })}
        className={`btn btn-xs ${filters.hideFulfilled ? 'btn-primary' : 'btn-ghost'}`}
      >
        {t('subjects.filter.hideFulfilled')}
      </button>
    </div>
  );
}
