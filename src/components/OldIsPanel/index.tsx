import { useMemo, useState } from 'react';
import { ExternalLink, Info, Search } from 'lucide-react';
import { pagesData } from '../../data/pages';
import { injectUserParams } from '../../data/pages/types';
import { PAGE_CATEGORY_ICONS } from '../../data/pages/categoryIcons';
import { filterPageCategories, pageLabel } from '../../data/pages/filterPages';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

/**
 * The original IS Mendelu, as a view of its own rather than a modal behind a
 * dim flyout row. Every page is shown at once as a real link, grouped the way
 * IS groups them, with the same accent-insensitive filter the phone's
 * "Starý IS" segment uses.
 */
export function OldIsPanel() {
  const { t, language } = useTranslation();
  const studiumId = useAppStore((s) => s.studiumId);
  const facultyId = useAppStore((s) => s.facultyId);
  const [filter, setFilter] = useState('');

  const categories = useMemo(
    () => filterPageCategories(pagesData, filter, language),
    [filter, language]
  );
  const pageCount = categories.reduce((n, c) => n + c.children.length, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-5 pb-4 border-b border-base-300">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-base-content">{t('sidebar.isPages')}</h1>
          <p className="text-sm text-base-content/70">{t('sidebar.oldIsHint')}</p>
        </div>
        <div className="relative flex-1 min-w-[240px] max-w-xl ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('search.filterPlaceholder')}
            aria-label={t('search.filterPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-base-200 border border-base-300 rounded-xl text-sm text-base-content placeholder-base-content/50 focus:outline-none focus:border-primary/50 transition-colors"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {categories.length === 0 ? (
          <div className="py-12 text-center text-sm text-base-content/60">{t('search.empty')}</div>
        ) : (
          <div className="columns-1 md:columns-2 2xl:columns-3 gap-4">
            {categories.map((category) => {
              const Icon = PAGE_CATEGORY_ICONS[category.id] ?? Info;
              return (
                <section
                  key={category.id}
                  className="card bg-base-200/30 border border-base-300 overflow-hidden mb-4 break-inside-avoid"
                >
                  <h2 className="flex items-center gap-3 px-4 py-3 bg-base-200 font-bold text-sm text-base-content">
                    <Icon className="w-5 h-5 text-base-content/70" />
                    {pageLabel(category, language)}
                  </h2>
                  <ul className="px-2 py-2">
                    {category.children.map((item) => (
                      <li key={item.id}>
                        <a
                          href={injectUserParams(
                            item.href,
                            studiumId,
                            language === 'en' ? 'en' : 'cz',
                            undefined,
                            facultyId
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-base-content/80 hover:bg-base-200 hover:text-primary transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            {pageLabel(item, language).replace(/<\/?(b|i|strong)>/g, '')}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-base-content/30 group-hover:text-base-content/60" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 py-2 border-t border-base-300 text-xs text-base-content/60">
        {t('sidebar.oldIsCount').replace('{count}', String(pageCount))}
      </div>
    </div>
  );
}
