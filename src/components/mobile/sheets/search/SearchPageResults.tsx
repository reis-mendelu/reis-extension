import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { PageItem } from '../../../../data/pages/types';
import { pageLabel } from '../../../../data/pages/filterPages';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { VisiblePageGroup } from './usePageDirectory';
import { NoResults } from './SearchStates';

export interface SearchPageResultsProps {
  groups: VisiblePageGroup[];
  openPage: (item: PageItem) => void;
  onToggle: (categoryId: string) => void;
  /** Index of the keyboard cursor within the flat list of visible rows. */
  selectedIndex: number;
  /** DOM id for the option at `i`, so the input can name it. */
  optionId: (i: number) => string;
  noResultsText: string;
}

/**
 * The Starý IS segment: IS Mendelu's own page directory, grouped by IS's
 * categories. Each category shows five pages until expanded, as the
 * extension's popover does; while filtering every match is shown.
 *
 * Rows are `role="option"` divs like the people and subject rows, not
 * `<a target="_blank">`: the app-wide link handler captures those, and the page
 * would open twice.
 */
export function SearchPageResults({
  groups,
  openPage,
  onToggle,
  selectedIndex,
  optionId,
  noResultsText,
}: SearchPageResultsProps) {
  const { t, language } = useTranslation();
  if (groups.length === 0) return <NoResults text={noResultsText} />;

  return (
    <>
      {groups.map(({ category, items, firstIndex, hiddenCount, expanded }, g) => (
        <div key={category.id} className={g === 0 ? '' : 'pt-2'}>
          <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {pageLabel(category, language)}
          </div>
          {items.map((item, i) => {
            const index = firstIndex + i;
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.id}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  openPage(item);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-base-200'}`}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-base-content">
                  {pageLabel(item, language)}
                </span>
                <ExternalLink
                  size={14}
                  className="flex-shrink-0 text-base-content/40"
                  aria-hidden="true"
                />
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => onToggle(category.id)}
              aria-expanded={expanded}
              // `--tone-primary`, not raw `text-primary`: the raw green measured
              // 2.29:1 on the light sheet (verify:ui).
              className="flex min-h-11 items-center gap-1.5 px-4 text-xs font-semibold text-[var(--tone-primary)]"
            >
              {expanded
                ? t('mobile.student.pagesShowLess')
                : t('mobile.student.pagesShowMore', { count: hiddenCount })}
              {expanded ? (
                <ChevronUp size={12} aria-hidden="true" />
              ) : (
                <ChevronDown size={12} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
