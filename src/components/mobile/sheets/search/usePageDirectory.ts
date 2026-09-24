import { useMemo, useState } from 'react';
import { pagesData } from '../../../../data/pages';
import { injectUserParams, type PageCategory, type PageItem } from '../../../../data/pages/types';
import { filterPageCategories, normalizePageQuery } from '../../../../data/pages/filterPages';
import { openExternal } from '../../../../mobile/openExternal';
import { logError } from '../../../../utils/reportError';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';

/** Rows a category shows before "show more" — the desktop popover's number. */
export const PAGES_COLLAPSED_COUNT = 5;

export interface VisiblePageGroup {
  category: PageCategory;
  /** The rows actually rendered, in order. */
  items: PageItem[];
  /** Index of `items[0]` in the flat row list, so option ids line up. */
  firstIndex: number;
  /** Rows beyond the collapsed five; 0 when there is nothing to expand. */
  hiddenCount: number;
  expanded: boolean;
}

/**
 * What the Starý IS segment renders, and the flat list the keyboard walks.
 *
 * Both come from ONE call on purpose: the option ids the rows carry and the
 * indices the cursor moves over have to be the same numbering, or
 * `aria-activedescendant` names a row other than the one Return opens.
 *
 * While filtering nothing is collapsed — a match hidden behind "show more"
 * would read as "not found".
 */
export function visiblePageGroups(
  categories: PageCategory[],
  isFiltering: boolean,
  expandedIds: ReadonlySet<string>
): { groups: VisiblePageGroup[]; rows: PageItem[] } {
  const rows: PageItem[] = [];
  const groups = categories.map((category) => {
    const collapsible = !isFiltering && category.children.length > PAGES_COLLAPSED_COUNT;
    const expanded = collapsible && expandedIds.has(category.id);
    const items =
      collapsible && !expanded
        ? category.children.slice(0, PAGES_COLLAPSED_COUNT)
        : category.children;
    const firstIndex = rows.length;
    rows.push(...items);
    const hiddenCount = collapsible ? category.children.length - PAGES_COLLAPSED_COUNT : 0;
    return { category, items, firstIndex, hiddenCount, expanded };
  });
  return { groups, rows };
}

/**
 * The Starý IS segment's state: the filtered, collapsed directory and how a
 * page is opened.
 */
export function usePageDirectory(query: string) {
  const { language } = useTranslation();
  const studiumId = useAppStore((s) => s.studiumId);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const isFiltering = normalizePageQuery(query).length > 0;

  const { groups, rows } = useMemo(
    () =>
      visiblePageGroups(filterPageCategories(pagesData, query, language), isFiltering, expandedIds),
    [query, language, isFiltering, expandedIds]
  );

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // openExternal, never window.open: on Capacitor that hands the URL to the
  // system browser, which has no IS session. openExternal keeps an IS link in
  // an in-app WebView carrying it (#292). Same params as the desktop popover.
  // Caught rather than voided: in demo mode it rejects with DemoModeError, and
  // logError is what turns that into the demo toast.
  const open = (item: PageItem) => {
    const url = injectUserParams(item.href, studiumId, language === 'en' ? 'en' : 'cz');
    openExternal(url).catch((e: unknown) => logError('SearchSheet.openPage', e));
  };

  // Which categories are open changes the rows without always changing their
  // count, so the sheet's cursor key has to include it.
  const expandedKey = [...expandedIds].sort().join(',');

  return { groups, rows, toggle, open, language, expandedKey };
}
