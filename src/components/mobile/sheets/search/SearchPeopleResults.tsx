import { SearchResultItem } from '../../../SearchBar/SearchResultItem';
import type { SearchResult } from '../../../SearchBar/types';
import { useTranslation } from '../../../../hooks/useTranslation';
import { NoResults, Searching } from './SearchStates';

export interface SearchPeopleResultsProps {
  peopleResults: SearchResult[];
  shownPeople: SearchResult[];
  hasQuery: boolean;
  canSearchPeople: boolean;
  searchingPeople: boolean;
  openPerson: (result: SearchResult) => void;
  noResultsText: string;
}

/**
 * The people half of the search sheet: the student's recent lookups while the
 * field is empty, then results. Split out of `SearchSheet` for the file-length
 * convention.
 */
export function SearchPeopleResults({
  peopleResults,
  shownPeople,
  hasQuery,
  canSearchPeople,
  searchingPeople,
  openPerson,
  noResultsText,
}: SearchPeopleResultsProps) {
  const { t } = useTranslation();
  return (
    <>
      {!hasQuery && shownPeople.length > 0 && (
        <>
          <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.student.recentPeople')}
          </div>
          {shownPeople.map((result) => (
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

      {/* Order matters: a query too short to search has no answer, an
  in-flight one does not have it yet, and only a finished search
  that came back empty has earned "nothing found". */}
      {canSearchPeople && peopleResults.length === 0 && searchingPeople && (
        <Searching text={t('search.loading')} />
      )}
      {canSearchPeople && peopleResults.length === 0 && !searchingPeople && (
        <NoResults text={noResultsText} />
      )}
    </>
  );
}
