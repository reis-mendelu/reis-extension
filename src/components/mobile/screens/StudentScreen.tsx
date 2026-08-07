import { useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSearch } from '../../SearchBar/useSearch';
import { SearchResultItem } from '../../SearchBar/SearchResultItem';
import type { SearchResult } from '../../SearchBar/types';
import { pagesData, injectUserParams } from '../../../data/pages';
import { openExternal } from '../../../mobile/openExternal';
import { ScreenHeader } from './calendar/ScreenHeader';
import { StudentSearch, type StudentMode } from './student/StudentSearch';
import { ShortcutGrid, type ShortcutSheetKind } from './student/ShortcutGrid';
import { PageGroupList, type PageGroup } from './student/PageGroupList';

function stripDiacritics(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildPageGroups(query: string, language: string): PageGroup[] {
  const normalized = stripDiacritics(query.trim());
  const pick = (label: string, labelEn?: string) =>
    language === 'en' && labelEn ? labelEn : label;

  return pagesData
    .map((category) => {
      const items = category.children
        .map((item) => ({ id: item.id, label: pick(item.label, item.labelEn), href: item.href }))
        .filter((item) => !normalized || stripDiacritics(item.label).includes(normalized));
      if (items.length === 0) return null;
      return { id: category.id, label: pick(category.label, category.labelEn), items };
    })
    .filter((group): group is PageGroup => group !== null);
}

function NoResults({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-base-content/50">{text}</p>;
}

export function StudentScreen() {
  const { t, language } = useTranslation();
  const [mode, setMode] = useState<StudentMode>('pages');
  const [query, setQuery] = useState('');

  const pushSheet = useAppStore((s) => s.pushSheet);
  const studiumId = useAppStore((s) => s.studiumId);
  const recentSearches = useAppStore((s) => s.recentSearches);

  const { sections, saveToHistory } = useSearch(query);
  const peopleResults = sections.find((s) => s.key === 'people')?.results ?? [];
  const teacherResults = useMemo(
    () => recentSearches.filter((r) => r.type === 'person' && r.personType === 'teacher'),
    [recentSearches]
  );

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const pageGroups = useMemo(() => buildPageGroups(query, language), [query, language]);

  const handleModeChange = (next: StudentMode) => {
    setMode(next);
    setQuery('');
  };

  const openHref = (href: string) => {
    // openExternal, not window.open: on Capacitor that hands the URL to the
    // system browser, which has no IS session.
    void openExternal(injectUserParams(href, studiumId, language === 'en' ? 'en' : 'cz'));
  };

  const openSheet = (kind: ShortcutSheetKind) => {
    if (kind === 'eduroam') pushSheet({ kind: 'eduroam' });
    else if (kind === 'docs') pushSheet({ kind: 'docs' });
    else pushSheet({ kind: 'erasmus' });
  };

  const openPerson = (result: SearchResult) => {
    saveToHistory(result);
    pushSheet({ kind: 'person', personId: result.id, personName: result.title });
  };

  const noResultsText = t('mobile.student.noResults');

  return (
    <div data-testid="student-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader title={t('mobile.student.title')} />
      <StudentSearch
        mode={mode}
        onModeChange={handleModeChange}
        query={query}
        onQueryChange={setQuery}
      />

      <div className="flex-1 overflow-y-auto pb-24 pt-2">
        {mode === 'pages' && (
          <>
            {!hasQuery && <ShortcutGrid onOpenSheet={openSheet} />}
            {pageGroups.length > 0 ? (
              <PageGroupList groups={pageGroups} onOpen={openHref} />
            ) : hasQuery ? (
              <NoResults text={noResultsText} />
            ) : null}
          </>
        )}

        {mode === 'people' && (
          <>
            {!hasQuery && (
              <>
                <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
                  {t('mobile.student.yourTeachers')}
                </div>
                {teacherResults.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isRecent={false}
                    isSelected={false}
                    onMouseEnter={() => {}}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openPerson(result);
                    }}
                  />
                ))}
              </>
            )}

            {hasQuery && peopleResults.length > 0 && (
              <>
                <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
                  {t('mobile.student.results')}
                </div>
                {peopleResults.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isRecent={false}
                    isSelected={false}
                    onMouseEnter={() => {}}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openPerson(result);
                    }}
                  />
                ))}
              </>
            )}

            {hasQuery && peopleResults.length === 0 && <NoResults text={noResultsText} />}
          </>
        )}
      </div>
    </div>
  );
}
