import { Globe } from 'lucide-react';
import { SearchResultItem } from '../../../SearchBar/SearchResultItem';
import type { SearchResult } from '../../../SearchBar/types';
import { useTranslation } from '../../../../hooks/useTranslation';
import { NoResults, Searching } from './SearchStates';

export interface SearchSubjectResultsProps {
  subjectResults: SearchResult[];
  /** Recently opened subjects, shown while the field is empty. */
  shownSubjects: SearchResult[];
  hasQuery: boolean;
  canSearchPeople: boolean;
  searchingPeople: boolean;
  scope: string;
  canScopeToFaculty: boolean;
  widenToUniversity: () => void;
  narrowToFaculty: () => void;
  openSubject: (result: SearchResult) => void;
  noResultsText: string;
}

/**
 * The subject-catalogue half of the search sheet. Split out of `SearchSheet`
 * for the file-length convention: the sheet owns the query and the two
 * destinations, each mode renders its own list.
 */
export function SearchSubjectResults({
  subjectResults,
  shownSubjects,
  hasQuery,
  canSearchPeople,
  searchingPeople,
  scope,
  canScopeToFaculty,
  widenToUniversity,
  narrowToFaculty,
  openSubject,
  noResultsText,
}: SearchSubjectResultsProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* The catalogue search is scoped to the student's own faculty by
  default, and a subject from another one is simply absent until
  the scope widens — which is exactly what "it does not work for
  subjects outside my faculty" meant on the iPad. The desktop and
  the old MobileSearchOverlay both render this; the Student tab
  did not, so the way out was unreachable on a phone.

  Above the results, not below them as on the desktop: this list
  runs to dozens of rows on a phone, and a control the student has
  to scroll past every result to reach is the same dead end in a
  politer form. */}
      {hasQuery && canScopeToFaculty && (
        <div className="flex items-center justify-between gap-2 border-t border-base-300 px-4 py-2.5">
          <span className="truncate text-[11px] text-base-content/50">
            {scope === 'faculty' ? t('search.facultyScopeNote') : t('search.universityScopeNote')}
          </span>
          <button
            type="button"
            // The preventDefault stays on mouseDown — the input is
            // focused and a click would blur it first, which on iPad
            // drops the keyboard and scrolls the list out from under the
            // finger mid-tap. The ACTION belongs on click: keyboard
            // activation of a button dispatches click and never
            // mousedown, so with both on mousedown, Enter and Space could
            // not change the scope at all — and an iPad with a keyboard
            // is the device this control was added for.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (scope === 'faculty') widenToUniversity();
              else narrowToFaculty();
            }}
            className="flex shrink-0 items-center gap-1.5 text-xs text-primary"
          >
            <Globe size={14} />
            {scope === 'faculty' ? t('search.widenToUniversity') : t('search.narrowToFaculty')}
          </button>
        </div>
      )}

      {/* Exactly what Lidé does with an empty field, and this side had
          nothing: a student comes back to the same four or five subjects all
          term, so the list they need is almost always one they have opened
          before. The scope note above stays query-only — there is nothing to
          widen the search of yet. */}
      {!hasQuery && shownSubjects.length > 0 && (
        <>
          <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.student.recentSubjects')}
          </div>
          {shownSubjects.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              isRecent={false}
              isSelected={false}
              onMouseEnter={() => {}}
              onMouseDown={(e) => {
                e.preventDefault();
                openSubject(result);
              }}
            />
          ))}
        </>
      )}

      {hasQuery && subjectResults.length > 0 && (
        <>
          <div className="px-4 pb-0.5 pt-1 text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('mobile.student.results')}
          </div>
          {subjectResults.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              isRecent={false}
              isSelected={false}
              onMouseEnter={() => {}}
              onMouseDown={(e) => {
                e.preventDefault();
                openSubject(result);
              }}
            />
          ))}
        </>
      )}

      {/* Same order as Lidé, and for the same reason: a query too short
  to search has no answer, an in-flight one does not have it yet,
  and only a finished search that came back empty has earned
  "nothing found". */}
      {canSearchPeople && subjectResults.length === 0 && searchingPeople && (
        <Searching text={t('search.loading')} />
      )}
      {canSearchPeople && subjectResults.length === 0 && !searchingPeople && (
        <NoResults text={noResultsText} />
      )}
    </>
  );
}
